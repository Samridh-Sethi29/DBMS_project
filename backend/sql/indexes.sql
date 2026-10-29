-- =============================================================================
-- indexes.sql  –  Index definitions for club_event_db (MySQL 8)
-- Run after schema.sql.  Contains three target indexes and a BEFORE/AFTER
-- analysis narrative (actual EXPLAIN ANALYZE runs are in perf_test.sql).
-- =============================================================================
USE club_event_db;

-- ---------------------------------------------------------------------------
-- Helper procedure to safely drop an index if it exists in information_schema
-- ---------------------------------------------------------------------------
DELIMITER $$

DROP PROCEDURE IF EXISTS _drop_index_if_exists$$
CREATE PROCEDURE _drop_index_if_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = p_table_name
      AND index_name   = p_index_name
  ) THEN
    SET @drop_stmt = CONCAT('DROP INDEX `', p_index_name, '` ON `', p_table_name, '`');
    PREPARE s FROM @drop_stmt;
    EXECUTE s;
    DEALLOCATE PREPARE s;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- Index 1: events(event_type, start_datetime)
-- Supports filtered + sorted queries on event listings (Section A Q4 / Q1).
-- ---------------------------------------------------------------------------
CALL _drop_index_if_exists('events', 'idx_events_type_start');
CREATE INDEX idx_events_type_start ON events (event_type, start_datetime);

-- ---------------------------------------------------------------------------
-- Index 2: registrations(student_id, status)
-- Supports per-student registration lookups filtered by status (Q6 / Q7).
-- ---------------------------------------------------------------------------
CALL _drop_index_if_exists('registrations', 'idx_reg_student_status');
CREATE INDEX idx_reg_student_status ON registrations (student_id, status);

-- ---------------------------------------------------------------------------
-- Index 3: students(year_of_study)
-- Supports queries filtered by student year of study.
-- (Note: department_id is already indexed by foreign key fk_students_dept).
-- ---------------------------------------------------------------------------
CALL _drop_index_if_exists('students', 'idx_students_year');
CREATE INDEX idx_students_year ON students (year_of_study);

DROP PROCEDURE IF EXISTS _drop_index_if_exists;

-- Note: events(venue_id, start_datetime, end_datetime) is already indexed as
-- idx_event_venue_time in schema.sql.

