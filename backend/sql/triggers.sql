-- =============================================================================
-- triggers.sql  –  All triggers for club_event_db (MySQL 8)
-- Run after schema.sql.  Re-runnable (DROP IF EXISTS before each CREATE).
-- Note: trg_events_no_overlap_insert/update and trg_cm_single_chair_insert/update
-- are defined in schema.sql and NOT redefined here.
-- =============================================================================
USE club_event_db;

DELIMITER $$

-- ===========================================================================
-- (a) BEFORE INSERT/UPDATE on events
--     Constraint 1: end_datetime > start_datetime (also checked by chk_event_time)
--     Constraint 2: max_participants <= venue.capacity (when max_participants is not null)
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_events_before_insert$$
CREATE TRIGGER trg_events_before_insert
BEFORE INSERT ON events
FOR EACH ROW
BEGIN
  DECLARE v_capacity INT;

  -- Constraint 1: temporal order
  IF NEW.end_datetime <= NEW.start_datetime THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'events: end_datetime must be after start_datetime.';
  END IF;

  -- Constraint 2: participant cap
  IF NEW.max_participants IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM venues WHERE venue_id = NEW.venue_id;
    IF v_capacity IS NOT NULL AND NEW.max_participants > v_capacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'events: max_participants exceeds venue capacity.';
    END IF;
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_events_before_update$$
CREATE TRIGGER trg_events_before_update
BEFORE UPDATE ON events
FOR EACH ROW
BEGIN
  DECLARE v_capacity INT;

  IF NEW.end_datetime <= NEW.start_datetime THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'events: end_datetime must be after start_datetime.';
  END IF;

  IF NEW.max_participants IS NOT NULL THEN
    SELECT capacity INTO v_capacity FROM venues WHERE venue_id = NEW.venue_id;
    IF v_capacity IS NOT NULL AND NEW.max_participants > v_capacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'events: max_participants exceeds venue capacity.';
    END IF;
  END IF;
END$$

-- ===========================================================================
-- (b) BEFORE INSERT/UPDATE: uppercase students.roll_no and venues.name
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_students_before_insert$$
CREATE TRIGGER trg_students_before_insert
BEFORE INSERT ON students
FOR EACH ROW
BEGIN
  SET NEW.roll_no = UPPER(NEW.roll_no);
END$$

DROP TRIGGER IF EXISTS trg_students_before_update$$
CREATE TRIGGER trg_students_before_update
BEFORE UPDATE ON students
FOR EACH ROW
BEGIN
  SET NEW.roll_no = UPPER(NEW.roll_no);
END$$

DROP TRIGGER IF EXISTS trg_venues_before_insert$$
CREATE TRIGGER trg_venues_before_insert
BEFORE INSERT ON venues
FOR EACH ROW
BEGIN
  SET NEW.name = UPPER(NEW.name);
END$$

DROP TRIGGER IF EXISTS trg_venues_before_update$$
CREATE TRIGGER trg_venues_before_update
BEFORE UPDATE ON venues
FOR EACH ROW
BEGIN
  SET NEW.name = UPPER(NEW.name);
END$$

-- ===========================================================================
-- (c) AFTER INSERT/UPDATE/DELETE on events, registrations, clubs
--     → writes old/new JSON rows to application_audit_log
-- ===========================================================================

-- ---- events ----
DROP TRIGGER IF EXISTS trg_events_audit_insert$$
CREATE TRIGGER trg_events_audit_insert
AFTER INSERT ON events
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('events', 'INSERT', NEW.event_id, NULL, JSON_OBJECT(
    'event_id', NEW.event_id, 'club_id', NEW.club_id, 'venue_id', NEW.venue_id,
    'title', NEW.title, 'event_type', NEW.event_type,
    'start_datetime', NEW.start_datetime, 'end_datetime', NEW.end_datetime,
    'is_tentative', NEW.is_tentative, 'signup_mode', NEW.signup_mode,
    'status', NEW.status, 'max_participants', NEW.max_participants
  ));
END$$

DROP TRIGGER IF EXISTS trg_events_audit_update$$
CREATE TRIGGER trg_events_audit_update
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('events', 'UPDATE', NEW.event_id,
    JSON_OBJECT(
      'event_id', OLD.event_id, 'title', OLD.title, 'event_type', OLD.event_type,
      'status', OLD.status, 'start_datetime', OLD.start_datetime,
      'end_datetime', OLD.end_datetime, 'max_participants', OLD.max_participants,
      'venue_id', OLD.venue_id, 'signup_mode', OLD.signup_mode
    ),
    JSON_OBJECT(
      'event_id', NEW.event_id, 'title', NEW.title, 'event_type', NEW.event_type,
      'status', NEW.status, 'start_datetime', NEW.start_datetime,
      'end_datetime', NEW.end_datetime, 'max_participants', NEW.max_participants,
      'venue_id', NEW.venue_id, 'signup_mode', NEW.signup_mode
    ));
END$$

DROP TRIGGER IF EXISTS trg_events_audit_delete$$
CREATE TRIGGER trg_events_audit_delete
AFTER DELETE ON events
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('events', 'DELETE', OLD.event_id, JSON_OBJECT(
    'event_id', OLD.event_id, 'title', OLD.title, 'status', OLD.status
  ), NULL);
END$$

-- ---- registrations ----
DROP TRIGGER IF EXISTS trg_registrations_audit_insert$$
CREATE TRIGGER trg_registrations_audit_insert
AFTER INSERT ON registrations
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('registrations', 'INSERT', NEW.registration_id, NULL, JSON_OBJECT(
    'registration_id', NEW.registration_id, 'event_id', NEW.event_id,
    'student_id', NEW.student_id, 'status', NEW.status, 'registered_at', NEW.registered_at
  ));
END$$

DROP TRIGGER IF EXISTS trg_registrations_audit_update$$
CREATE TRIGGER trg_registrations_audit_update
AFTER UPDATE ON registrations
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('registrations', 'UPDATE', NEW.registration_id,
    JSON_OBJECT('registration_id', OLD.registration_id, 'status', OLD.status),
    JSON_OBJECT('registration_id', NEW.registration_id, 'status', NEW.status)
  );
END$$

DROP TRIGGER IF EXISTS trg_registrations_audit_delete$$
CREATE TRIGGER trg_registrations_audit_delete
AFTER DELETE ON registrations
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('registrations', 'DELETE', OLD.registration_id, JSON_OBJECT(
    'registration_id', OLD.registration_id, 'event_id', OLD.event_id,
    'student_id', OLD.student_id, 'status', OLD.status
  ), NULL);
END$$

-- ---- clubs ----
DROP TRIGGER IF EXISTS trg_clubs_audit_insert$$
CREATE TRIGGER trg_clubs_audit_insert
AFTER INSERT ON clubs
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('clubs', 'INSERT', NEW.club_id, NULL, JSON_OBJECT(
    'club_id', NEW.club_id, 'name', NEW.name, 'status', NEW.status,
    'category_id', NEW.category_id, 'faculty_advisor_id', NEW.faculty_advisor_id
  ));
END$$

DROP TRIGGER IF EXISTS trg_clubs_audit_update$$
CREATE TRIGGER trg_clubs_audit_update
AFTER UPDATE ON clubs
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('clubs', 'UPDATE', NEW.club_id,
    JSON_OBJECT('club_id', OLD.club_id, 'name', OLD.name, 'status', OLD.status, 'faculty_advisor_id', OLD.faculty_advisor_id),
    JSON_OBJECT('club_id', NEW.club_id, 'name', NEW.name, 'status', NEW.status, 'faculty_advisor_id', NEW.faculty_advisor_id)
  );
END$$

DROP TRIGGER IF EXISTS trg_clubs_audit_delete$$
CREATE TRIGGER trg_clubs_audit_delete
AFTER DELETE ON clubs
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('clubs', 'DELETE', OLD.club_id, JSON_OBJECT(
    'club_id', OLD.club_id, 'name', OLD.name, 'status', OLD.status
  ), NULL);
END$$

-- ===========================================================================
-- (d) BEFORE INSERT/UPDATE/DELETE on registrations
--     Block changes on Mondays between 14:00 and 16:00
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_registrations_block_monday_insert$$
CREATE TRIGGER trg_registrations_block_monday_insert
BEFORE INSERT ON registrations
FOR EACH ROW
BEGIN
  IF DAYOFWEEK(NOW()) = 2                      -- 2 = Monday in MySQL
     AND TIME(NOW()) BETWEEN '14:00:00' AND '16:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Modifications are not allowed on Mondays between 2 PM and 4 PM';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_registrations_block_monday_update$$
CREATE TRIGGER trg_registrations_block_monday_update
BEFORE UPDATE ON registrations
FOR EACH ROW
BEGIN
  IF DAYOFWEEK(NOW()) = 2
     AND TIME(NOW()) BETWEEN '14:00:00' AND '16:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Modifications are not allowed on Mondays between 2 PM and 4 PM';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_registrations_block_monday_delete$$
CREATE TRIGGER trg_registrations_block_monday_delete
BEFORE DELETE ON registrations
FOR EACH ROW
BEGIN
  IF DAYOFWEEK(NOW()) = 2
     AND TIME(NOW()) BETWEEN '14:00:00' AND '16:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Modifications are not allowed on Mondays between 2 PM and 4 PM';
  END IF;
END$$

DELIMITER ;
