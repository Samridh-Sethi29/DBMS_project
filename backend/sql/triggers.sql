-- =============================================================================
-- triggers.sql  –  All triggers for club_event_db (MySQL 8)
-- Run after schema.sql.  Re-runnable (DROP IF EXISTS before each CREATE).
-- =============================================================================
-- NOTE ON MYSQL LIMITATIONS:
--   MySQL does not support statement-level triggers (Oracle-style AFTER STATEMENT).
--   All triggers here are row-level (FOR EACH ROW implied in MySQL).
--   The audit-log triggers below fire once per modified row; for bulk DML this
--   produces one log entry per row, which is functionally equivalent to a
--   statement-level audit.  This limitation is noted per the assignment spec.
-- =============================================================================
USE club_event_db;

DELIMITER $$

-- ===========================================================================
-- (a) BEFORE INSERT/UPDATE on events
--     Constraint 1: end_datetime > start_datetime
--     Constraint 2: max_participants <= venue.capacity
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
  SELECT capacity INTO v_capacity FROM venues WHERE venue_id = NEW.venue_id;
  IF NEW.max_participants > v_capacity THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'events: max_participants exceeds venue capacity.';
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

  SELECT capacity INTO v_capacity FROM venues WHERE venue_id = NEW.venue_id;
  IF NEW.max_participants > v_capacity THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'events: max_participants exceeds venue capacity.';
  END IF;
END$$

-- Venue time-overlap check (pre-existing requirement):
-- Prevent double-booking the same venue in overlapping windows.
DROP TRIGGER IF EXISTS trg_events_venue_overlap_insert$$
CREATE TRIGGER trg_events_venue_overlap_insert
BEFORE INSERT ON events
FOR EACH ROW
FOLLOWS trg_events_before_insert
BEGIN
  DECLARE v_conflict INT;
  SELECT COUNT(*) INTO v_conflict
  FROM   events
  WHERE  venue_id      = NEW.venue_id
    AND  status        NOT IN ('cancelled')
    AND  event_id      <> NEW.event_id
    AND  start_datetime < NEW.end_datetime
    AND  end_datetime   > NEW.start_datetime;

  IF v_conflict > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue is already booked for an overlapping time window.';
  END IF;
END$$

DROP TRIGGER IF EXISTS trg_events_venue_overlap_update$$
CREATE TRIGGER trg_events_venue_overlap_update
BEFORE UPDATE ON events
FOR EACH ROW
FOLLOWS trg_events_before_update
BEGIN
  DECLARE v_conflict INT;
  SELECT COUNT(*) INTO v_conflict
  FROM   events
  WHERE  venue_id      = NEW.venue_id
    AND  status        NOT IN ('cancelled')
    AND  event_id      <> NEW.event_id
    AND  start_datetime < NEW.end_datetime
    AND  end_datetime   > NEW.start_datetime;

  IF v_conflict > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue is already booked for an overlapping time window.';
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
      'venue_id', OLD.venue_id
    ),
    JSON_OBJECT(
      'event_id', NEW.event_id, 'title', NEW.title, 'event_type', NEW.event_type,
      'status', NEW.status, 'start_datetime', NEW.start_datetime,
      'end_datetime', NEW.end_datetime, 'max_participants', NEW.max_participants,
      'venue_id', NEW.venue_id
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
    'category_id', NEW.category_id, 'coordinator_id', NEW.coordinator_id
  ));
END$$

DROP TRIGGER IF EXISTS trg_clubs_audit_update$$
CREATE TRIGGER trg_clubs_audit_update
AFTER UPDATE ON clubs
FOR EACH ROW
BEGIN
  INSERT INTO application_audit_log (table_name, action, record_id, old_data, new_data)
  VALUES ('clubs', 'UPDATE', NEW.club_id,
    JSON_OBJECT('club_id', OLD.club_id, 'name', OLD.name, 'status', OLD.status),
    JSON_OBJECT('club_id', NEW.club_id, 'name', NEW.name, 'status', NEW.status)
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
--     PRECEDES the audit triggers so the block fires before any audit write.
-- ===========================================================================

DROP TRIGGER IF EXISTS trg_registrations_block_monday_insert$$
CREATE TRIGGER trg_registrations_block_monday_insert
BEFORE INSERT ON registrations
FOR EACH ROW
PRECEDES trg_registrations_audit_insert
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
PRECEDES trg_registrations_audit_update
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
PRECEDES trg_registrations_audit_delete
BEGIN
  IF DAYOFWEEK(NOW()) = 2
     AND TIME(NOW()) BETWEEN '14:00:00' AND '16:00:00' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Modifications are not allowed on Mondays between 2 PM and 4 PM';
  END IF;
END$$

DELIMITER ;
