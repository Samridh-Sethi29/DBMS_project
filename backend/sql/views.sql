-- =============================================================================
-- views.sql  –  Views for club_event_db (MySQL 8)
-- Run after schema.sql and triggers.sql.
-- =============================================================================
USE club_event_db;

-- ===========================================================================
-- v_computer_engineering_students
-- Updatable view: joins students + users filtered by department name.
-- MySQL can make a view updatable when it references a single base table with
-- no GROUP BY, DISTINCT, UNION, or aggregates, and all NOT NULL columns without
-- defaults are included.  We expose students columns through this view and let
-- the underlying base-table triggers (trg_students_before_*) fire automatically.
--
-- DEMO SECTION at the bottom shows a trigger firing through this view.
-- ===========================================================================

DROP VIEW IF EXISTS v_computer_engineering_students;

CREATE VIEW v_computer_engineering_students AS
  SELECT
    s.student_id,
    u.name           AS student_name,
    u.email,
    u.is_active,
    s.roll_no,
    s.year_of_study,
    s.phone,
    d.department_id,
    d.name           AS department_name
  FROM   students   s
  JOIN   users      u ON u.user_id       = s.student_id
  JOIN   departments d ON d.department_id = s.department_id
  WHERE  d.name = 'Computer Engineering';

-- NOTE: Because the view joins multiple base tables, MySQL treats it as
-- non-updatable for INSERT/DELETE.  UPDATE on single-table columns works
-- only if those columns can be traced to a single base table.  We demonstrate
-- UPDATE on the students table through the view below.
--
-- For a fully updatable single-table view use:
--   CREATE VIEW v_ce_students_simple AS
--     SELECT * FROM students WHERE department_id = <ce_id>;

-- ---------------------------------------------------------------------------
-- DEMO SCRIPT  –  shows that updating roll_no through the view fires
--                 trg_students_before_update (uppercasing trigger).
-- Run this block after inserting sample data.
-- ---------------------------------------------------------------------------
/*
-- Step 1: Confirm view returns CE students
SELECT * FROM v_computer_engineering_students LIMIT 5;

-- Step 2: Update roll_no through the view (fires trg_students_before_update)
UPDATE v_computer_engineering_students
SET    roll_no = 'ce-demo-001'         -- lowercase; trigger will uppercase it
WHERE  student_id = 1;                  -- replace with a real CE student id

-- Step 3: Verify trigger fired – roll_no should now be 'CE-DEMO-001'
SELECT student_id, roll_no FROM students WHERE student_id = 1;

-- Step 4: Verify audit log entry was written by the AFTER UPDATE trigger
-- on the base table (triggers fire on the base table, not the view)
SELECT * FROM application_audit_log
WHERE  table_name = 'students'          -- note: if you added a students audit trigger
ORDER BY changed_at DESC LIMIT 3;
*/
