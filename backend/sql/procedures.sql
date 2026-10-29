-- =============================================================================
-- procedures.sql  –  Stored Procedures for club_event_db (MySQL 8)
-- Run after schema.sql.  Re-runnable (DROP IF EXISTS before each CREATE).
-- =============================================================================
USE club_event_db;

DELIMITER $$

-- ===========================================================================
-- HELPER: validate non-empty string
-- ===========================================================================
DROP PROCEDURE IF EXISTS _assert_not_blank$$
CREATE PROCEDURE _assert_not_blank(IN p_val VARCHAR(1000), IN p_field VARCHAR(100))
BEGIN
  IF p_val IS NULL OR TRIM(p_val) = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = CONCAT(p_field, ' must not be blank');
  END IF;
END$$

-- ===========================================================================
-- USER PROCEDURES
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- sp_user_register
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_user_register$$
CREATE PROCEDURE sp_user_register(
  IN  p_name          VARCHAR(150),
  IN  p_email         VARCHAR(255),
  IN  p_password_hash VARCHAR(255),
  IN  p_role          VARCHAR(20),
  OUT p_user_id       INT
)
BEGIN
  CALL _assert_not_blank(p_name,  'name');
  CALL _assert_not_blank(p_email, 'email');
  CALL _assert_not_blank(p_password_hash, 'password_hash');

  IF p_role NOT IN ('student','coordinator','admin') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid role. Must be student, coordinator, or admin.';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A user with this email already exists.';
  END IF;

  INSERT INTO users (name, email, password_hash, role)
  VALUES (p_name, p_email, p_password_hash, p_role);

  SET p_user_id = LAST_INSERT_ID();
END$$

-- ---------------------------------------------------------------------------
-- sp_user_update
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_user_update$$
CREATE PROCEDURE sp_user_update(
  IN p_user_id INT,
  IN p_name    VARCHAR(150),
  IN p_email   VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'User not found or is inactive.';
  END IF;

  CALL _assert_not_blank(p_name,  'name');
  CALL _assert_not_blank(p_email, 'email');

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email AND user_id <> p_user_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Email already taken by another user.';
  END IF;

  UPDATE users SET name = p_name, email = p_email WHERE user_id = p_user_id;
END$$

-- ---------------------------------------------------------------------------
-- sp_user_deactivate  (soft delete)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_user_deactivate$$
CREATE PROCEDURE sp_user_deactivate(IN p_user_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'User not found.';
  END IF;

  UPDATE users SET is_active = 0 WHERE user_id = p_user_id;
END$$

-- ---------------------------------------------------------------------------
-- sp_user_get_for_login  (returns the row; bcrypt check happens in Node)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_user_get_for_login$$
CREATE PROCEDURE sp_user_get_for_login(IN p_email VARCHAR(255))
BEGIN
  SELECT user_id, name, email, password_hash, role, is_active
  FROM   users
  WHERE  email = p_email;
END$$

-- ===========================================================================
-- STUDENT PROCEDURES
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- sp_insert_student
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_insert_student$$
CREATE PROCEDURE sp_insert_student(
  IN  p_name          VARCHAR(150),
  IN  p_email         VARCHAR(255),
  IN  p_password_hash VARCHAR(255),
  IN  p_roll_no       VARCHAR(20),
  IN  p_department_id INT,
  IN  p_year_of_study TINYINT,
  IN  p_phone         VARCHAR(20),
  OUT p_student_id    INT
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  CALL _assert_not_blank(p_name,    'name');
  CALL _assert_not_blank(p_email,   'email');
  CALL _assert_not_blank(p_roll_no, 'roll_no');

  IF p_year_of_study NOT BETWEEN 1 AND 6 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'year_of_study must be between 1 and 6.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM departments WHERE department_id = p_department_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Department not found.';
  END IF;

  START TRANSACTION;
    -- Create the user row first
    CALL sp_user_register(p_name, p_email, p_password_hash, 'student', @uid);
    SET p_student_id = @uid;

    INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone)
    VALUES (p_student_id, UPPER(p_roll_no), p_department_id, p_year_of_study, p_phone);
  COMMIT;
END$$

-- ---------------------------------------------------------------------------
-- sp_update_student
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_update_student$$
CREATE PROCEDURE sp_update_student(
  IN p_student_id   INT,
  IN p_name         VARCHAR(150),
  IN p_email        VARCHAR(255),
  IN p_roll_no      VARCHAR(20),
  IN p_department_id INT,
  IN p_year_of_study TINYINT,
  IN p_phone        VARCHAR(20)
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = p_student_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student not found.';
  END IF;

  IF p_year_of_study NOT BETWEEN 1 AND 6 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'year_of_study must be between 1 and 6.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM departments WHERE department_id = p_department_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Department not found.';
  END IF;

  IF EXISTS (SELECT 1 FROM students WHERE roll_no = UPPER(p_roll_no) AND student_id <> p_student_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Roll number already taken by another student.';
  END IF;

  START TRANSACTION;
    CALL sp_user_update(p_student_id, p_name, p_email);
    UPDATE students
    SET    roll_no        = UPPER(p_roll_no),
           department_id  = p_department_id,
           year_of_study  = p_year_of_study,
           phone          = p_phone
    WHERE  student_id = p_student_id;
  COMMIT;
END$$

-- ---------------------------------------------------------------------------
-- sp_delete_student  (soft delete via user deactivate)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_delete_student$$
CREATE PROCEDURE sp_delete_student(IN p_student_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM students WHERE student_id = p_student_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student not found.';
  END IF;
  CALL sp_user_deactivate(p_student_id);
END$$

-- ===========================================================================
-- VENUE PROCEDURES
-- ===========================================================================

DROP PROCEDURE IF EXISTS sp_insert_venue$$
CREATE PROCEDURE sp_insert_venue(
  IN  p_name     VARCHAR(150),
  IN  p_location VARCHAR(255),
  IN  p_capacity INT,
  OUT p_venue_id INT
)
BEGIN
  CALL _assert_not_blank(p_name, 'name');

  IF p_capacity <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue capacity must be greater than 0.';
  END IF;

  IF EXISTS (SELECT 1 FROM venues WHERE name = UPPER(p_name)) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A venue with this name already exists.';
  END IF;

  INSERT INTO venues (name, location, capacity)
  VALUES (UPPER(p_name), p_location, p_capacity);
  SET p_venue_id = LAST_INSERT_ID();
END$$

DROP PROCEDURE IF EXISTS sp_update_venue$$
CREATE PROCEDURE sp_update_venue(
  IN p_venue_id  INT,
  IN p_name      VARCHAR(150),
  IN p_location  VARCHAR(255),
  IN p_capacity  INT
)
BEGIN
  CALL _assert_not_blank(p_name, 'name');

  IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue not found.';
  END IF;

  IF p_capacity <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue capacity must be greater than 0.';
  END IF;

  IF EXISTS (SELECT 1 FROM venues WHERE name = UPPER(p_name) AND venue_id <> p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Another venue already has this name.';
  END IF;

  UPDATE venues
  SET    name     = UPPER(p_name),
         location = p_location,
         capacity = p_capacity
  WHERE  venue_id = p_venue_id;
END$$

DROP PROCEDURE IF EXISTS sp_delete_venue$$
CREATE PROCEDURE sp_delete_venue(IN p_venue_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue not found.';
  END IF;

  IF EXISTS (SELECT 1 FROM events WHERE venue_id = p_venue_id AND status NOT IN ('completed','cancelled')) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot delete venue: it has scheduled/ongoing events.';
  END IF;

  DELETE FROM venues WHERE venue_id = p_venue_id;
END$$

-- ===========================================================================
-- CLUB PROCEDURES
-- ===========================================================================

DROP PROCEDURE IF EXISTS sp_insert_club$$
CREATE PROCEDURE sp_insert_club(
  IN  p_name           VARCHAR(150),
  IN  p_description    TEXT,
  IN  p_category_id    INT,
  IN  p_coordinator_id INT,
  OUT p_club_id        INT
)
BEGIN
  CALL _assert_not_blank(p_name, 'name');

  IF NOT EXISTS (SELECT 1 FROM club_categories WHERE category_id = p_category_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Club category not found.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_coordinator_id AND role = 'coordinator' AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Coordinator user not found or is not active/coordinator.';
  END IF;

  IF EXISTS (SELECT 1 FROM clubs WHERE name = p_name) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A club with this name already exists.';
  END IF;

  INSERT INTO clubs (name, description, category_id, coordinator_id)
  VALUES (p_name, p_description, p_category_id, p_coordinator_id);
  SET p_club_id = LAST_INSERT_ID();
END$$

DROP PROCEDURE IF EXISTS sp_update_club$$
CREATE PROCEDURE sp_update_club(
  IN p_club_id        INT,
  IN p_name           VARCHAR(150),
  IN p_description    TEXT,
  IN p_category_id    INT,
  IN p_coordinator_id INT,
  IN p_status         VARCHAR(20)
)
BEGIN
  CALL _assert_not_blank(p_name, 'name');

  IF NOT EXISTS (SELECT 1 FROM clubs WHERE club_id = p_club_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Club not found.';
  END IF;

  IF p_status NOT IN ('active','inactive') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid status. Must be active or inactive.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM club_categories WHERE category_id = p_category_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Club category not found.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_coordinator_id AND role = 'coordinator' AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Coordinator user not found or is not active/coordinator.';
  END IF;

  IF EXISTS (SELECT 1 FROM clubs WHERE name = p_name AND club_id <> p_club_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Another club already has this name.';
  END IF;

  UPDATE clubs
  SET    name           = p_name,
         description    = p_description,
         category_id    = p_category_id,
         coordinator_id = p_coordinator_id,
         status         = p_status
  WHERE  club_id = p_club_id;
END$$

DROP PROCEDURE IF EXISTS sp_delete_club$$
CREATE PROCEDURE sp_delete_club(IN p_club_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clubs WHERE club_id = p_club_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Club not found.';
  END IF;

  UPDATE clubs SET status = 'inactive' WHERE club_id = p_club_id;
END$$

-- ===========================================================================
-- EVENT PROCEDURES
-- ===========================================================================

DROP PROCEDURE IF EXISTS sp_insert_event$$
CREATE PROCEDURE sp_insert_event(
  IN  p_club_id               INT,
  IN  p_venue_id              INT,
  IN  p_title                 VARCHAR(200),
  IN  p_description           TEXT,
  IN  p_event_type            VARCHAR(20),
  IN  p_start_datetime        DATETIME,
  IN  p_end_datetime          DATETIME,
  IN  p_registration_deadline DATETIME,
  IN  p_max_participants      INT,
  IN  p_created_by            INT,
  OUT p_event_id              INT
)
BEGIN
  CALL _assert_not_blank(p_title, 'title');

  IF p_event_type NOT IN ('technical','cultural','academic','sports','workshop','other') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid event_type.';
  END IF;

  IF p_end_datetime <= p_start_datetime THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'end_datetime must be after start_datetime.';
  END IF;

  IF p_registration_deadline >= p_start_datetime THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'registration_deadline must be before start_datetime.';
  END IF;

  IF p_max_participants <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'max_participants must be greater than 0.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM clubs WHERE club_id = p_club_id AND status = 'active') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Club not found or is inactive.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Venue not found.';
  END IF;

  -- Capacity check (also enforced by trigger)
  IF p_max_participants > (SELECT capacity FROM venues WHERE venue_id = p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'max_participants exceeds venue capacity.';
  END IF;

  INSERT INTO events (club_id, venue_id, title, description, event_type, start_datetime,
                      end_datetime, registration_deadline, max_participants, created_by)
  VALUES (p_club_id, p_venue_id, p_title, p_description, p_event_type, p_start_datetime,
          p_end_datetime, p_registration_deadline, p_max_participants, p_created_by);
  SET p_event_id = LAST_INSERT_ID();
END$$

DROP PROCEDURE IF EXISTS sp_update_event$$
CREATE PROCEDURE sp_update_event(
  IN p_event_id             INT,
  IN p_venue_id             INT,
  IN p_title                VARCHAR(200),
  IN p_description          TEXT,
  IN p_event_type           VARCHAR(20),
  IN p_start_datetime       DATETIME,
  IN p_end_datetime         DATETIME,
  IN p_registration_deadline DATETIME,
  IN p_max_participants     INT,
  IN p_status               VARCHAR(20)
)
BEGIN
  CALL _assert_not_blank(p_title, 'title');

  IF NOT EXISTS (SELECT 1 FROM events WHERE event_id = p_event_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Event not found.';
  END IF;

  IF p_event_type NOT IN ('technical','cultural','academic','sports','workshop','other') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid event_type.';
  END IF;

  IF p_status NOT IN ('scheduled','ongoing','completed','cancelled') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid event status.';
  END IF;

  IF p_end_datetime <= p_start_datetime THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'end_datetime must be after start_datetime.';
  END IF;

  IF p_max_participants > (SELECT capacity FROM venues WHERE venue_id = p_venue_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'max_participants exceeds venue capacity.';
  END IF;

  UPDATE events
  SET    venue_id              = p_venue_id,
         title                 = p_title,
         description           = p_description,
         event_type            = p_event_type,
         start_datetime        = p_start_datetime,
         end_datetime          = p_end_datetime,
         registration_deadline = p_registration_deadline,
         max_participants      = p_max_participants,
         status                = p_status
  WHERE  event_id = p_event_id;
END$$

DROP PROCEDURE IF EXISTS sp_delete_event$$
CREATE PROCEDURE sp_delete_event(IN p_event_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM events WHERE event_id = p_event_id) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Event not found.';
  END IF;

  IF EXISTS (SELECT 1 FROM registrations WHERE event_id = p_event_id AND status = 'registered') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot delete event with active registrations. Cancel it instead.';
  END IF;

  -- Cascade: cancel event (soft delete)
  UPDATE events SET status = 'cancelled' WHERE event_id = p_event_id;
END$$

-- ===========================================================================
-- sp_register_student  –  called by POST /events/:id/register
-- Uses SELECT … FOR UPDATE (row lock) inside a transaction.
-- ===========================================================================
DROP PROCEDURE IF EXISTS sp_register_student$$
CREATE PROCEDURE sp_register_student(
  IN  p_event_id   INT,
  IN  p_student_id INT,
  OUT p_reg_id     INT
)
BEGIN
  DECLARE v_max_participants INT;
  DECLARE v_current_count    INT;
  DECLARE v_deadline         DATETIME;
  DECLARE v_event_status     VARCHAR(20);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Lock the event row to prevent race conditions
  SELECT max_participants, registration_deadline, status
  INTO   v_max_participants, v_deadline, v_event_status
  FROM   events
  WHERE  event_id = p_event_id
  FOR UPDATE;

  IF v_max_participants IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Event not found.';
  END IF;

  IF v_event_status NOT IN ('scheduled','ongoing') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Event is not open for registration.';
  END IF;

  IF NOW() > v_deadline THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Registration deadline has passed.';
  END IF;

  -- Count current active registrations (also lock them)
  SELECT COUNT(*) INTO v_current_count
  FROM   registrations
  WHERE  event_id = p_event_id AND status = 'registered'
  FOR UPDATE;

  IF v_current_count >= v_max_participants THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Event is fully booked.';
  END IF;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM registrations
    WHERE event_id = p_event_id AND student_id = p_student_id AND status = 'registered'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Student is already registered for this event.';
  END IF;

  INSERT INTO registrations (event_id, student_id, status)
  VALUES (p_event_id, p_student_id, 'registered');
  SET p_reg_id = LAST_INSERT_ID();

  COMMIT;
END$$

DELIMITER ;
