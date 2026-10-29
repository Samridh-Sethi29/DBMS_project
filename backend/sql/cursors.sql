-- =============================================================================
-- cursors.sql  –  Explicit cursor procedures for club_event_db (MySQL 8)
-- Run after schema.sql and procedures.sql.
-- =============================================================================
USE club_event_db;

DELIMITER $$

-- ===========================================================================
-- (A) sp_cursor_all
-- Explicit cursor over ALL registrations (no batching).
-- Builds per-event summaries into a temp table, then returns the result set.
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_cursor_all$$
CREATE PROCEDURE sp_cursor_all()
BEGIN
  -- Cursor variables
  DECLARE v_done          INT     DEFAULT FALSE;
  DECLARE v_event_id      INT;
  DECLARE v_student_id    INT;
  DECLARE v_reg_status    VARCHAR(20);
  DECLARE v_att_status    VARCHAR(20);

  -- Explicit cursor: join registrations → attendance (LEFT so absent rows included)
  DECLARE cur_regs CURSOR FOR
    SELECT  r.event_id,
            r.student_id,
            r.status          AS reg_status,
            COALESCE(a.status,'absent') AS att_status
    FROM    registrations r
    LEFT JOIN attendance a ON a.registration_id = r.registration_id
    ORDER BY r.event_id;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  -- Temp summary table (session-scoped; no TRUNCATE needed on first run)
  DROP   TEMPORARY TABLE IF EXISTS tmp_event_summary;
  CREATE TEMPORARY TABLE tmp_event_summary (
    event_id             INT NOT NULL,
    total_registrations  INT NOT NULL DEFAULT 0,
    active_registrations INT NOT NULL DEFAULT 0,
    cancelled            INT NOT NULL DEFAULT 0,
    present_count        INT NOT NULL DEFAULT 0,
    absent_count         INT NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id)
  );

  OPEN cur_regs;

  read_loop: LOOP
    FETCH cur_regs INTO v_event_id, v_student_id, v_reg_status, v_att_status;
    IF v_done THEN LEAVE read_loop; END IF;

    -- Upsert into summary
    INSERT INTO tmp_event_summary (event_id, total_registrations, active_registrations,
                                   cancelled, present_count, absent_count)
    VALUES (v_event_id, 1,
            IF(v_reg_status='registered',1,0),
            IF(v_reg_status='cancelled',1,0),
            IF(v_att_status='present',1,0),
            IF(v_att_status='absent',1,0))
    ON DUPLICATE KEY UPDATE
      total_registrations  = total_registrations  + 1,
      active_registrations = active_registrations + IF(v_reg_status='registered',1,0),
      cancelled            = cancelled            + IF(v_reg_status='cancelled',1,0),
      present_count        = present_count        + IF(v_att_status='present',1,0),
      absent_count         = absent_count         + IF(v_att_status='absent',1,0);
  END LOOP;

  CLOSE cur_regs;

  -- Return the summary enriched with the event title
  SELECT  s.event_id,
          e.title          AS event_title,
          e.start_datetime,
          s.total_registrations,
          s.active_registrations,
          s.cancelled,
          s.present_count,
          s.absent_count
  FROM    tmp_event_summary s
  JOIN    events e ON e.event_id = s.event_id
  ORDER BY s.event_id;

  DROP TEMPORARY TABLE IF EXISTS tmp_event_summary;
END$$

-- ===========================================================================
-- (B) sp_cursor_batched(p_batch_size)
-- Same logic but processes registrations in batches using LIMIT/OFFSET.
-- NOTE: MySQL does not support BULK COLLECT … LIMIT (Oracle-only feature).
--       We emulate "cursor with limit" by re-querying with LIMIT/OFFSET inside
--       a WHILE loop, which gives the same bounded-memory processing semantics.
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_cursor_batched$$
CREATE PROCEDURE sp_cursor_batched(IN p_batch_size INT)
BEGIN
  DECLARE v_offset      INT DEFAULT 0;
  DECLARE v_rows_fetched INT;
  DECLARE v_event_id    INT;
  DECLARE v_reg_status  VARCHAR(20);
  DECLARE v_att_status  VARCHAR(20);
  DECLARE v_done        INT DEFAULT FALSE;

  -- Each batch uses a fresh cursor; declare once, open per iteration
  DECLARE cur_batch CURSOR FOR
    SELECT  r.event_id,
            r.status                          AS reg_status,
            COALESCE(a.status,'absent')       AS att_status
    FROM    registrations r
    LEFT JOIN attendance a ON a.registration_id = r.registration_id
    ORDER BY r.event_id
    LIMIT p_batch_size OFFSET v_offset;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

  IF p_batch_size IS NULL OR p_batch_size <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'p_batch_size must be a positive integer.';
  END IF;

  DROP   TEMPORARY TABLE IF EXISTS tmp_event_summary_b;
  CREATE TEMPORARY TABLE tmp_event_summary_b (
    event_id             INT NOT NULL,
    total_registrations  INT NOT NULL DEFAULT 0,
    active_registrations INT NOT NULL DEFAULT 0,
    cancelled            INT NOT NULL DEFAULT 0,
    present_count        INT NOT NULL DEFAULT 0,
    absent_count         INT NOT NULL DEFAULT 0,
    PRIMARY KEY (event_id)
  );

  batch_loop: LOOP
    SET v_done        = FALSE;
    SET v_rows_fetched = 0;

    OPEN cur_batch;

    inner_loop: LOOP
      FETCH cur_batch INTO v_event_id, v_reg_status, v_att_status;
      IF v_done THEN LEAVE inner_loop; END IF;

      SET v_rows_fetched = v_rows_fetched + 1;

      INSERT INTO tmp_event_summary_b (event_id, total_registrations, active_registrations,
                                       cancelled, present_count, absent_count)
      VALUES (v_event_id, 1,
              IF(v_reg_status='registered',1,0),
              IF(v_reg_status='cancelled',1,0),
              IF(v_att_status='present',1,0),
              IF(v_att_status='absent',1,0))
      ON DUPLICATE KEY UPDATE
        total_registrations  = total_registrations  + 1,
        active_registrations = active_registrations + IF(v_reg_status='registered',1,0),
        cancelled            = cancelled            + IF(v_reg_status='cancelled',1,0),
        present_count        = present_count        + IF(v_att_status='present',1,0),
        absent_count         = absent_count         + IF(v_att_status='absent',1,0);
    END LOOP inner_loop;

    CLOSE cur_batch;

    -- Advance offset for next batch
    SET v_offset = v_offset + p_batch_size;

    -- Exit when the last batch returned fewer rows than the batch size
    IF v_rows_fetched < p_batch_size THEN LEAVE batch_loop; END IF;
  END LOOP batch_loop;

  SELECT  s.event_id,
          e.title          AS event_title,
          e.start_datetime,
          s.total_registrations,
          s.active_registrations,
          s.cancelled,
          s.present_count,
          s.absent_count
  FROM    tmp_event_summary_b s
  JOIN    events e ON e.event_id = s.event_id
  ORDER BY s.event_id;

  DROP TEMPORARY TABLE IF EXISTS tmp_event_summary_b;
END$$

DELIMITER ;
