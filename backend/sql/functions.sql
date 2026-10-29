-- =============================================================================
-- functions.sql  –  Functions, search procedure, aggregation procedures
-- Run after schema.sql and procedures.sql.
-- =============================================================================
USE club_event_db;

DELIMITER $$

-- ===========================================================================
-- fn_total_capacity()
-- Scalar function: returns the sum of all venue capacities (no grouping).
-- NOTE: MySQL stored functions cannot return result sets, so aggregate scalar
--       results are implemented as functions while grouped results use procedures.
-- ===========================================================================
DROP FUNCTION IF EXISTS fn_total_capacity$$
CREATE FUNCTION fn_total_capacity()
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE v_total INT;
  SELECT COALESCE(SUM(capacity), 0) INTO v_total FROM venues;
  RETURN v_total;
END$$

-- ===========================================================================
-- sp_search_events(p_keyword, p_type, p_status, p_from, p_to, p_page, p_page_size)
-- Paged search procedure.  NULL = no filter for that column.
-- Returns two result sets: page rows, then a single-row total_count.
-- NOTE: MySQL functions cannot return result sets; a stored PROCEDURE is used
--       so both the page and the count can be returned as separate SELECT sets.
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_search_events$$
CREATE PROCEDURE sp_search_events(
  IN p_keyword   VARCHAR(255),   -- NULL → no keyword filter
  IN p_type      VARCHAR(20),    -- NULL → all types
  IN p_status    VARCHAR(20),    -- NULL → all statuses
  IN p_from      DATETIME,       -- NULL → no lower date bound
  IN p_to        DATETIME,       -- NULL → no upper date bound
  IN p_page      INT,            -- 1-based page number
  IN p_page_size INT             -- rows per page (max enforced by caller)
)
BEGIN
  DECLARE v_offset INT;
  DECLARE v_total  INT;

  IF p_page      IS NULL OR p_page      < 1 THEN SET p_page      = 1;      END IF;
  IF p_page_size IS NULL OR p_page_size < 1 THEN SET p_page_size = 20;     END IF;
  IF p_page_size > 100                       THEN SET p_page_size = 100;    END IF;

  SET v_offset = (p_page - 1) * p_page_size;

  -- Count query (same WHERE logic)
  SELECT COUNT(*) INTO v_total
  FROM   events e
  WHERE  (p_keyword IS NULL OR e.title LIKE CONCAT('%', p_keyword, '%')
                            OR e.description LIKE CONCAT('%', p_keyword, '%'))
    AND  (p_type   IS NULL OR e.event_type = p_type)
    AND  (p_status IS NULL OR e.status     = p_status)
    AND  (p_from   IS NULL OR e.start_datetime >= p_from)
    AND  (p_to     IS NULL OR e.start_datetime <= p_to);

  -- Page result set
  SELECT
    e.event_id,
    e.title,
    e.event_type,
    e.start_datetime,
    e.end_datetime,
    e.registration_deadline,
    e.max_participants,
    e.status,
    c.name  AS club_name,
    v.name  AS venue_name,
    v_total AS total_count
  FROM   events e
  JOIN   clubs  c ON c.club_id  = e.club_id
  JOIN   venues v ON v.venue_id = e.venue_id
  WHERE  (p_keyword IS NULL OR e.title LIKE CONCAT('%', p_keyword, '%')
                            OR e.description LIKE CONCAT('%', p_keyword, '%'))
    AND  (p_type   IS NULL OR e.event_type = p_type)
    AND  (p_status IS NULL OR e.status     = p_status)
    AND  (p_from   IS NULL OR e.start_datetime >= p_from)
    AND  (p_to     IS NULL OR e.start_datetime <= p_to)
  ORDER BY e.start_datetime DESC
  LIMIT  p_page_size OFFSET v_offset;
END$$

-- ===========================================================================
-- sp_sum_grouped  –  Grouped aggregation examples
-- Returns registration count per club (joins three tables; demonstrates GROUP BY).
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_sum_grouped$$
CREATE PROCEDURE sp_sum_grouped()
BEGIN
  SELECT
    c.club_id,
    c.name                             AS club_name,
    COUNT(r.registration_id)           AS total_registrations,
    SUM(r.status = 'registered')       AS active_registrations,
    SUM(r.status = 'cancelled')        AS cancelled_registrations,
    COUNT(DISTINCT e.event_id)         AS total_events
  FROM   clubs c
  LEFT JOIN events       e ON e.club_id   = c.club_id
  LEFT JOIN registrations r ON r.event_id = e.event_id
  GROUP BY c.club_id, c.name
  ORDER BY total_registrations DESC;
END$$

-- ===========================================================================
-- sp_sum_column(p_table, p_column)
-- Dynamic aggregation with a HARD-CODED allowlist to prevent SQL injection.
-- Only whitelisted (table, column) pairs are accepted; all others get a 400-
-- equivalent SIGNAL.
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_sum_column$$
CREATE PROCEDURE sp_sum_column(
  IN p_table  VARCHAR(100),
  IN p_column VARCHAR(100)
)
BEGIN
  -- -------------------------------------------------------------------------
  -- ALLOWLIST: only these (table, column) pairs may be summed.
  -- Add entries here as the schema grows; never interpolate user input directly.
  -- -------------------------------------------------------------------------
  DECLARE v_allowed TINYINT DEFAULT 0;

  IF   (p_table = 'events'        AND p_column = 'max_participants') THEN SET v_allowed = 1;
  ELSEIF (p_table = 'registrations' AND p_column = 'registration_id')  THEN SET v_allowed = 1;
  ELSEIF (p_table = 'venues'        AND p_column = 'capacity')          THEN SET v_allowed = 1;
  ELSEIF (p_table = 'attendance'    AND p_column = 'attendance_id')     THEN SET v_allowed = 1;
  ELSEIF (p_table = 'certificates'  AND p_column = 'certificate_id')    THEN SET v_allowed = 1;
  END IF;

  IF v_allowed = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'sp_sum_column: table/column combination is not in the allowlist.';
  END IF;

  -- Safe: table and column names come from our allowlist, not from user input.
  -- We use prepared statements for safety/clarity even though names are trusted.
  SET @sql = CONCAT('SELECT COUNT(*) AS row_count, SUM(`', p_column, '`) AS total_sum'
                    ' FROM `', p_table, '`');
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END$$

DELIMITER ;
