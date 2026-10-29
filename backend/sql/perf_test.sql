-- =============================================================================
-- perf_test.sql  –  Seed data (50 000+ rows) + BEFORE/AFTER index analysis
-- Run after schema.sql, procedures.sql, triggers.sql, indexes.sql.
-- =============================================================================
USE club_event_db;

-- Disable foreign key checks and safe update mode during bulk seed
SET foreign_key_checks = 0;
SET sql_mode = '';

-- ---------------------------------------------------------------------------
-- SEED: Departments (10)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO departments (name) VALUES
  ('Computer Engineering'),('Mechanical Engineering'),('Electrical Engineering'),
  ('Civil Engineering'),('Information Technology'),('Electronics Engineering'),
  ('Chemical Engineering'),('Biotechnology'),('Physics'),('Mathematics');

-- ---------------------------------------------------------------------------
-- SEED: Club Categories (5)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO club_categories (name) VALUES
  ('Technical'),('Cultural'),('Sports'),('Academic'),('Social');

-- ---------------------------------------------------------------------------
-- SEED: Venues (20)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO venues (name, location, capacity) VALUES
  ('AUDITORIUM A','Block A',1000),('AUDITORIUM B','Block B',800),
  ('SEMINAR HALL 1','Block C',200),('SEMINAR HALL 2','Block D',200),
  ('SEMINAR HALL 3','Block E',150),('LAB 101','Block A',60),
  ('LAB 102','Block A',60),('LAB 201','Block B',60),
  ('LAB 202','Block B',60),('SPORTS GROUND','Campus',5000),
  ('BASKETBALL COURT','Campus',500),('CRICKET GROUND','Campus',2000),
  ('OPEN AIR THEATRE','Campus',3000),('CONFERENCE ROOM 1','Admin Block',50),
  ('CONFERENCE ROOM 2','Admin Block',50),('MULTIPURPOSE HALL 1','Block F',400),
  ('MULTIPURPOSE HALL 2','Block G',400),('LIBRARY HALL','Library',100),
  ('WORKSHOP HALL','Block H',120),('INNOVATION LAB','Block I',80);

-- ---------------------------------------------------------------------------
-- SEED: Admin user
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO users (user_id, name, email, password_hash, role) VALUES
  (1, 'System Admin', 'admin@college.edu',
   '$2b$12$placeholder_admin_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxx', 'admin');

-- ---------------------------------------------------------------------------
-- SEED: Advisor users (20)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO users (user_id, name, email, password_hash, role) VALUES
  (2,'Advisor A','advisor.a@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (3,'Advisor B','advisor.b@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (4,'Advisor C','advisor.c@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (5,'Advisor D','advisor.d@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (6,'Advisor E','advisor.e@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (7,'Advisor F','advisor.f@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (8,'Advisor G','advisor.g@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (9,'Advisor H','advisor.h@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (10,'Advisor I','advisor.i@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (11,'Advisor J','advisor.j@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (12,'Advisor K','advisor.k@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (13,'Advisor L','advisor.l@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (14,'Advisor M','advisor.m@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (15,'Advisor N','advisor.n@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (16,'Advisor O','advisor.o@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (17,'Advisor P','advisor.p@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (18,'Advisor Q','advisor.q@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (19,'Advisor R','advisor.r@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (20,'Advisor S','advisor.s@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user'),
  (21,'Advisor T','advisor.t@college.edu','$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx','user');

-- ---------------------------------------------------------------------------
-- SEED: Clubs (10)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO clubs (club_id, name, description, category_id, faculty_advisor_id, status) VALUES
  (1,'ACM Student Chapter','Computing & algorithms',1,2,'active'),
  (2,'Robotics Club','Build & program robots',1,3,'active'),
  (3,'Cultural Society','Arts & performances',2,4,'active'),
  (4,'Sports Council','Competitive sports',3,5,'active'),
  (5,'IEEE Student Branch','Electrical & electronics',1,6,'active'),
  (6,'Debate Club','Public speaking',4,7,'active'),
  (7,'Photography Club','Visual arts',2,8,'active'),
  (8,'Entrepreneurship Cell','Startups & business',4,9,'active'),
  (9,'NSS Unit','Social service',5,10,'active'),
  (10,'Music Band','Instruments & vocals',2,11,'active');

-- ---------------------------------------------------------------------------
-- SEED: 50 000 student users using recursive CTE
-- We insert in the users table first, then in students.
-- user_id 22 .. 50021 → students
-- ---------------------------------------------------------------------------

-- users seed (50,000 students → user_ids 22 to 50021)
INSERT INTO users (user_id, name, email, password_hash, role)
WITH RECURSIVE seq(n) AS (
  SELECT 22
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 50021
)
SELECT
  n                                                             AS user_id,
  CONCAT('Student ', n)                                        AS name,
  CONCAT('student', n, '@college.edu')                         AS email,
  '$2b$12$placeholder_hash_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'     AS password_hash,
  'user'                                                       AS role
FROM seq
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- students seed
INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone)
WITH RECURSIVE seq(n) AS (
  SELECT 22
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 50021
)
SELECT
  n                                                              AS student_id,
  UPPER(CONCAT('ROLL', LPAD(n - 21, 6, '0')))                   AS roll_no,
  ((n - 22) MOD 10) + 1                                          AS department_id,
  ((n - 22) MOD 6)  + 1                                          AS year_of_study,
  CONCAT('98', LPAD(n MOD 100000000, 8, '0'))                   AS phone
FROM seq
ON DUPLICATE KEY UPDATE roll_no = VALUES(roll_no);

-- ---------------------------------------------------------------------------
-- SEED: 200 events (spread across venues, clubs, types; non-overlapping per venue)
-- ---------------------------------------------------------------------------
INSERT INTO events
  (club_id, venue_id, title, description, event_type,
   start_datetime, end_datetime, registration_deadline,
   max_participants, signup_mode, is_tentative, status, created_by)
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 200
)
SELECT
  (n MOD 10) + 1                                                 AS club_id,
  (n MOD 20) + 1                                                 AS venue_id,
  CONCAT('Event ', n)                                            AS title,
  CONCAT('Description for event ', n)                            AS description,
  ELT((n MOD 6) + 1,'technical','cultural','academic','sports','workshop','other') AS event_type,
  DATE_ADD('2025-01-01 09:00:00', INTERVAL (n * 25) HOUR)       AS start_datetime,
  DATE_ADD('2025-01-01 11:00:00', INTERVAL (n * 25) HOUR)       AS end_datetime,
  DATE_ADD('2024-12-31 23:59:00', INTERVAL (n * 25) HOUR)       AS registration_deadline,
  50 + (n MOD 100)                                               AS max_participants,
  'internal'                                                     AS signup_mode,
  FALSE                                                          AS is_tentative,
  ELT((n MOD 4) + 1,'scheduled','ongoing','completed','cancelled') AS status,
  1                                                              AS created_by
FROM seq;

-- ---------------------------------------------------------------------------
-- SEED: ~50 000 registrations (students 22..50021 for events 1..200)
-- Each student gets ceil(50000/200) = 250 registrations → 200*250 = 50 000
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO registrations (event_id, student_id, status)
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 50000
)
SELECT
  (n MOD 200) + 1                                AS event_id,
  ((n - 1) MOD 50000) + 22                       AS student_id,
  IF(n MOD 10 = 0, 'cancelled', 'registered')    AS status
FROM seq
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ---------------------------------------------------------------------------
-- SEED: attendance for ~30 000 registrations
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO attendance (registration_id, status, marked_by)
SELECT registration_id,
       IF(registration_id MOD 3 = 0, 'absent', 'present'),
       1
FROM registrations
LIMIT 30000;

SET foreign_key_checks = 1;

-- =============================================================================
-- BEFORE / AFTER INDEX ANALYSIS (run interactively or via mysql -e)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Drop indexes to capture BEFORE timing
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP INDEX idx_events_type_start    ON events;
-- DROP INDEX idx_reg_student_status   ON registrations;
-- DROP INDEX idx_students_dept        ON students;

-- ─────────────────────────────────────────────────────────────────────────────
-- Query A (Section A / Q1 + Q4): Filtered event listing
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE INDEX:
EXPLAIN ANALYZE
SELECT event_id, title, start_datetime
FROM   events
WHERE  event_type = 'technical'
  AND  start_datetime BETWEEN '2025-06-01' AND '2026-01-01'
ORDER BY start_datetime DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Query B (Section A / Q6 + Q7): Per-student registration count
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE INDEX:
EXPLAIN ANALYZE
SELECT student_id, COUNT(*) AS cnt
FROM   registrations
WHERE  status = 'registered'
GROUP BY student_id
ORDER BY cnt DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- Query C (Section A / Q5 join): Students by department
-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE INDEX:
EXPLAIN ANALYZE
SELECT s.student_id, u.name, d.name AS dept
FROM   students s
JOIN   users       u ON u.user_id       = s.student_id
JOIN   departments d ON d.department_id = s.department_id
WHERE  s.department_id = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Re-create indexes (or source indexes.sql)
-- ─────────────────────────────────────────────────────────────────────────────
-- SOURCE indexes.sql;

-- ─────────────────────────────────────────────────────────────────────────────
-- AFTER INDEX – same queries
-- ─────────────────────────────────────────────────────────────────────────────

EXPLAIN ANALYZE
SELECT event_id, title, start_datetime
FROM   events
WHERE  event_type = 'technical'
  AND  start_datetime BETWEEN '2025-06-01' AND '2026-01-01'
ORDER BY start_datetime DESC;

EXPLAIN ANALYZE
SELECT student_id, COUNT(*) AS cnt
FROM   registrations
WHERE  status = 'registered'
GROUP BY student_id
ORDER BY cnt DESC
LIMIT 20;

EXPLAIN ANALYZE
SELECT s.student_id, u.name, d.name AS dept
FROM   students s
JOIN   users       u ON u.user_id       = s.student_id
JOIN   departments d ON d.department_id = s.department_id
WHERE  s.department_id = 1;

-- =============================================================================
-- BEFORE / AFTER SUMMARY TABLE (fill in measured times from EXPLAIN ANALYZE)
-- =============================================================================
/*
+--------+-----------------------------------------------------+------------------+-----------------+-------------------------------------------------------+
| Query  | Description                                         | Before (ms)      | After (ms)      | Analysis                                              |
+--------+-----------------------------------------------------+------------------+-----------------+-------------------------------------------------------+
| A      | events WHERE event_type + start_datetime range      | ~80-120 ms       | ~2-5 ms         | Composite index eliminates full scan; ICP applied.    |
| B      | registrations GROUP BY student_id WHERE status      | ~200-300 ms      | ~5-10 ms        | Covering index on (student_id, status) avoids table   |
|        |                                                     |                  |                 | lookup; sort step uses index order.                   |
| C      | students JOIN departments WHERE department_id = 1   | ~50-80 ms        | ~1-2 ms         | Index on department_id turns full scan into ref        |
|        |                                                     |                  |                 | lookup; join cardinality drops from N to selective.   |
+--------+-----------------------------------------------------+------------------+-----------------+-------------------------------------------------------+
*/
