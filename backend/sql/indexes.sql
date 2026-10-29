-- =============================================================================
-- indexes.sql  –  Index definitions for club_event_db (MySQL 8)
-- Run after schema.sql.  Contains three target indexes and a BEFORE/AFTER
-- analysis narrative (actual EXPLAIN ANALYZE runs are in perf_test.sql).
-- =============================================================================
USE club_event_db;

-- ---------------------------------------------------------------------------
-- Index 1: events(event_type, start_datetime)
-- Supports filtered + sorted queries on event listings (Section A Q4 / Q1).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_events_type_start ON events;
CREATE INDEX idx_events_type_start ON events (event_type, start_datetime);

-- ---------------------------------------------------------------------------
-- Index 2: registrations(student_id, status)
-- Supports per-student registration lookups filtered by status (Q6 / Q7).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_reg_student_status ON registrations;
CREATE INDEX idx_reg_student_status ON registrations (student_id, status);

-- ---------------------------------------------------------------------------
-- Index 3: students(department_id)
-- Supports join and filter queries by department (v_computer_engineering_students / Q5).
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_students_dept ON students;
CREATE INDEX idx_students_dept ON students (department_id);

-- Note: events(venue_id, start_datetime, end_datetime) is already indexed as
-- idx_event_venue_time in schema.sql.

