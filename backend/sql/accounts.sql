-- =============================================================================
-- accounts.sql  –  MySQL roles and users for club_event_db (MySQL 8)
-- Run after schema.sql.  Re-runnable.
-- =============================================================================
USE club_event_db;

-- ---------------------------------------------------------------------------
-- 1. DROP legacy objects (idempotent)
-- ---------------------------------------------------------------------------
DROP ROLE IF EXISTS role_naive, role_developer, role_dba;

-- Users may not exist yet; suppress error with IF EXISTS
DROP USER IF EXISTS 'user_naive'@'localhost';
DROP USER IF EXISTS 'user_developer'@'localhost';
DROP USER IF EXISTS 'user_dba'@'localhost';

-- ---------------------------------------------------------------------------
-- 2. Create ROLES
-- ---------------------------------------------------------------------------

-- role_naive: read-only + EXECUTE on read-only stored procedures
CREATE ROLE 'role_naive';
GRANT SELECT ON club_event_db.* TO 'role_naive';
-- Allow running user-facing read procedures
GRANT EXECUTE ON PROCEDURE club_event_db.sp_user_get_for_login  TO 'role_naive';
GRANT EXECUTE ON PROCEDURE club_event_db.sp_cursor_all          TO 'role_naive';
GRANT EXECUTE ON PROCEDURE club_event_db.sp_cursor_batched      TO 'role_naive';
GRANT EXECUTE ON PROCEDURE club_event_db.sp_search_events       TO 'role_naive';
GRANT EXECUTE ON PROCEDURE club_event_db.sp_sum_grouped         TO 'role_naive';
GRANT EXECUTE ON PROCEDURE club_event_db.sp_sum_column          TO 'role_naive';
GRANT EXECUTE ON FUNCTION  club_event_db.fn_total_capacity      TO 'role_naive';
GRANT EXECUTE ON FUNCTION  club_event_db.fn_club_rank          TO 'role_naive';

-- role_developer: full CRUD + EXECUTE on all procedures + CREATE VIEW
CREATE ROLE 'role_developer';
GRANT SELECT, INSERT, UPDATE, DELETE ON club_event_db.* TO 'role_developer';
GRANT EXECUTE ON club_event_db.* TO 'role_developer';
GRANT CREATE VIEW ON club_event_db.* TO 'role_developer';

-- role_dba: superuser scope on this database
CREATE ROLE 'role_dba';
GRANT ALL PRIVILEGES ON club_event_db.* TO 'role_dba' WITH GRANT OPTION;

-- ---------------------------------------------------------------------------
-- 3. Create concrete database USERS and assign roles
-- ---------------------------------------------------------------------------
-- Passwords are intentionally weak; change before production use.
CREATE USER 'user_naive'@'localhost'     IDENTIFIED BY 'NaivePass#123';
CREATE USER 'user_developer'@'localhost' IDENTIFIED BY 'DevPass#456';
CREATE USER 'user_dba'@'localhost'       IDENTIFIED BY 'DbaPass#789';

GRANT 'role_naive'     TO 'user_naive'@'localhost';
GRANT 'role_developer' TO 'user_developer'@'localhost';
GRANT 'role_dba'       TO 'user_dba'@'localhost';

-- Activate the default role so the role is in effect without SET ROLE
SET DEFAULT ROLE 'role_naive'     TO 'user_naive'@'localhost';
SET DEFAULT ROLE 'role_developer' TO 'user_developer'@'localhost';
SET DEFAULT ROLE 'role_dba'       TO 'user_dba'@'localhost';

ALTER USER 'user_naive'@'localhost'     DEFAULT ROLE 'role_naive';
ALTER USER 'user_developer'@'localhost' DEFAULT ROLE 'role_developer';
ALTER USER 'user_dba'@'localhost'       DEFAULT ROLE 'role_dba';

-- ---------------------------------------------------------------------------
-- 4. Sample GRANT then REVOKE on role_naive (demonstrates privilege mechanics)
-- ---------------------------------------------------------------------------
-- Grant INSERT on one table to role_naive, then revoke it
GRANT  INSERT ON club_event_db.registrations TO   'role_naive';
REVOKE INSERT ON club_event_db.registrations FROM 'role_naive';

-- Give developer the ability to grant SELECT to others
GRANT SELECT ON club_event_db.* TO 'user_developer'@'localhost' WITH GRANT OPTION;

-- ---------------------------------------------------------------------------
-- 5. SHOW GRANTS for verification
-- ---------------------------------------------------------------------------
SHOW GRANTS FOR 'user_naive'@'localhost';
SHOW GRANTS FOR 'user_developer'@'localhost';
SHOW GRANTS FOR 'user_dba'@'localhost';
SHOW GRANTS FOR 'role_naive';
SHOW GRANTS FOR 'role_developer';
SHOW GRANTS FOR 'role_dba';

FLUSH PRIVILEGES;
