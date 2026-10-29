-- =====================================================================
-- College Club and Event Management System  |  MySQL 8.0.16+  (v2)
-- Per-club roles, club pages, optional sign-up links, event photos.
-- WARNING: this script DROPS and recreates the database.
-- Assumptions (change if your rules differ):
--   * A club has at most ONE active chair (enforced by trigger).
--   * Core members / chairs must first be APPROVED club members (CHECK).
--   * Only an admin can appoint or change chairs and vice chairs.
--   * Chairs / vice chairs can promote or demote core members.
--   * Tentative events still block their venue.
-- =====================================================================
DROP DATABASE IF EXISTS club_event_db;
CREATE DATABASE club_event_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE club_event_db;

-- ---------------------------------------------------------------------
-- 1. LOOKUP TABLES
-- ---------------------------------------------------------------------
CREATE TABLE departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE club_categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 2. USERS  (global role is only 'user' or 'admin'; club roles live in club_members)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  user_id           INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(120) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  role              ENUM('user','admin') NOT NULL DEFAULT 'user',
  profile_photo_url VARCHAR(255) NULL,           -- shown on core member cards
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
);

CREATE TABLE students (
  student_id    INT PRIMARY KEY,                 -- same value as users.user_id
  roll_no       VARCHAR(30) NOT NULL UNIQUE,
  department_id INT NOT NULL,
  year_of_study TINYINT NOT NULL,
  phone         VARCHAR(15),
  CONSTRAINT chk_year CHECK (year_of_study BETWEEN 1 AND 6),
  CONSTRAINT fk_student_user FOREIGN KEY (student_id)    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_student_dept FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- ---------------------------------------------------------------------
-- 3. CLUBS AND MEMBERSHIPS
-- ---------------------------------------------------------------------
CREATE TABLE clubs (
  club_id            INT AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100) NOT NULL UNIQUE,
  tagline            VARCHAR(160) NULL,
  description        TEXT,                        -- editable by core members (sanitize in the API)
  logo_url           VARCHAR(255) NULL,
  website_url        VARCHAR(255) NULL,
  category_id        INT NOT NULL,
  faculty_advisor_id INT NULL,                    -- optional staff contact (replaces old coordinator)
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by         INT NULL,
  CONSTRAINT chk_club_website CHECK (website_url IS NULL
        OR website_url LIKE 'http://%' OR website_url LIKE 'https://%'),
  CONSTRAINT fk_club_cat     FOREIGN KEY (category_id)        REFERENCES club_categories(category_id),
  CONSTRAINT fk_club_advisor FOREIGN KEY (faculty_advisor_id) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_club_updater FOREIGN KEY (updated_by)         REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_clubs_category (category_id)
);

-- Student <-> club, with the per-club role
CREATE TABLE club_members (
  club_id         INT NOT NULL,
  student_id      INT NOT NULL,
  member_role     ENUM('member','core_member','vice_chair','chair') NOT NULL DEFAULT 'member',
  position_title  VARCHAR(60) NULL,               -- e.g. 'Treasurer', 'Design Lead'
  display_order   SMALLINT NOT NULL DEFAULT 100,  -- ordering on the core member section
  status          ENUM('pending','approved','left') NOT NULL DEFAULT 'pending',
  granted_by      INT NULL,                       -- who assigned the current role
  role_granted_at TIMESTAMP NULL,
  joined_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, student_id),
  CONSTRAINT chk_role_needs_approval CHECK (member_role = 'member' OR status = 'approved'),
  CONSTRAINT fk_cm_club    FOREIGN KEY (club_id)    REFERENCES clubs(club_id)       ON DELETE CASCADE,
  CONSTRAINT fk_cm_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_granter FOREIGN KEY (granted_by) REFERENCES users(user_id)       ON DELETE SET NULL,
  INDEX idx_cm_student (student_id),
  INDEX idx_cm_club_role (club_id, status, member_role, display_order)
);

-- ---------------------------------------------------------------------
-- 4. VENUES AND EVENTS
-- ---------------------------------------------------------------------
CREATE TABLE venues (
  venue_id INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(150),
  capacity INT NOT NULL,
  CONSTRAINT chk_venue_cap CHECK (capacity > 0)
);

CREATE TABLE events (
  event_id              INT AUTO_INCREMENT PRIMARY KEY,
  club_id               INT NOT NULL,
  venue_id              INT NOT NULL,
  title                 VARCHAR(150) NOT NULL,
  description           TEXT,
  event_type            ENUM('technical','cultural','academic','sports','workshop','other') NOT NULL DEFAULT 'other',
  start_datetime        DATETIME NOT NULL,
  end_datetime          DATETIME NOT NULL,
  is_tentative          BOOLEAN NOT NULL DEFAULT FALSE,  -- date not final yet
  poster_url            VARCHAR(255) NULL,
  recap_text            TEXT NULL,                       -- shown on the memory page
  signup_mode           ENUM('none','internal','external') NOT NULL DEFAULT 'none',
  external_signup_url   VARCHAR(255) NULL,
  registration_deadline DATETIME NULL,                   -- optional
  max_participants      INT NULL,                        -- NULL = unlimited
  status                ENUM('scheduled','ongoing','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_by            INT NOT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_event_time     CHECK (end_datetime > start_datetime),
  CONSTRAINT chk_event_deadline CHECK (registration_deadline IS NULL OR registration_deadline <= start_datetime),
  CONSTRAINT chk_event_max      CHECK (max_participants IS NULL OR max_participants > 0),
  CONSTRAINT chk_signup_external CHECK (signup_mode <> 'external' OR external_signup_url IS NOT NULL),
  CONSTRAINT chk_signup_internal CHECK (signup_mode <> 'internal' OR max_participants IS NOT NULL),
  CONSTRAINT chk_signup_url     CHECK (external_signup_url IS NULL
        OR external_signup_url LIKE 'http://%' OR external_signup_url LIKE 'https://%'),
  CONSTRAINT fk_event_club  FOREIGN KEY (club_id)    REFERENCES clubs(club_id),
  CONSTRAINT fk_event_venue FOREIGN KEY (venue_id)   REFERENCES venues(venue_id),
  CONSTRAINT fk_event_user  FOREIGN KEY (created_by) REFERENCES users(user_id),
  INDEX idx_event_venue_time (venue_id, start_datetime, end_datetime),   -- conflict check
  INDEX idx_event_club_start (club_id, start_datetime),                  -- club page
  INDEX idx_event_status_start (status, start_datetime)
);

-- Memory page photos
CREATE TABLE event_photos (
  photo_id      INT AUTO_INCREMENT PRIMARY KEY,
  event_id      INT NOT NULL,
  image_url     VARCHAR(255) NOT NULL,
  thumbnail_url VARCHAR(255) NULL,
  caption       VARCHAR(200) NULL,
  display_order SMALLINT NOT NULL DEFAULT 100,
  uploaded_by   INT NOT NULL,
  uploaded_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_photo_event FOREIGN KEY (event_id)    REFERENCES events(event_id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_user  FOREIGN KEY (uploaded_by) REFERENCES users(user_id),
  INDEX idx_photo_event (event_id, display_order)
);

-- ---------------------------------------------------------------------
-- 5. REGISTRATION, ATTENDANCE, CERTIFICATES  (internal sign-ups only)
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  registration_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id        INT NOT NULL,
  student_id      INT NOT NULL,
  status          ENUM('registered','cancelled') NOT NULL DEFAULT 'registered',
  registered_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_student (event_id, student_id),
  CONSTRAINT fk_reg_event   FOREIGN KEY (event_id)   REFERENCES events(event_id)     ON DELETE CASCADE,
  CONSTRAINT fk_reg_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  INDEX idx_reg_student (student_id)
);

CREATE TABLE attendance (
  attendance_id   INT AUTO_INCREMENT PRIMARY KEY,
  registration_id INT NOT NULL UNIQUE,
  status          ENUM('present','absent') NOT NULL,
  marked_by       INT NOT NULL,
  marked_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_att_reg  FOREIGN KEY (registration_id) REFERENCES registrations(registration_id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (marked_by)       REFERENCES users(user_id)
);

CREATE TABLE certificates (
  certificate_id   INT AUTO_INCREMENT PRIMARY KEY,
  registration_id  INT NOT NULL UNIQUE,
  certificate_code VARCHAR(40) NOT NULL UNIQUE,
  certificate_type ENUM('participation','winner','runner_up','organizer') NOT NULL DEFAULT 'participation',
  issued_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_reg FOREIGN KEY (registration_id) REFERENCES registrations(registration_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 6. AUDIT LOG (used by the audit triggers in the PL/SQL-style assignment)
-- ---------------------------------------------------------------------
CREATE TABLE application_audit_log (
  log_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  action     ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  record_id  INT NOT NULL,
  old_data   JSON NULL,
  new_data   JSON NULL,
  db_user    VARCHAR(100) NOT NULL DEFAULT (CURRENT_USER()),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table_time (table_name, changed_at)
);

-- =====================================================================
-- TRIGGERS, FUNCTIONS, PROCEDURES
-- =====================================================================
DELIMITER $$

-- Venue double-booking (tentative events also block the venue) ---------
CREATE TRIGGER trg_events_no_overlap_insert
BEFORE INSERT ON events FOR EACH ROW
BEGIN
  IF NEW.status <> 'cancelled' AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.venue_id = NEW.venue_id
        AND e.status <> 'cancelled'
        AND e.start_datetime < NEW.end_datetime
        AND e.end_datetime   > NEW.start_datetime) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venue is already booked for this time slot';
  END IF;
END$$

CREATE TRIGGER trg_events_no_overlap_update
BEFORE UPDATE ON events FOR EACH ROW
BEGIN
  IF NEW.status <> 'cancelled' AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.venue_id = NEW.venue_id
        AND e.event_id <> NEW.event_id
        AND e.status <> 'cancelled'
        AND e.start_datetime < NEW.end_datetime
        AND e.end_datetime   > NEW.start_datetime) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Venue is already booked for this time slot';
  END IF;
END$$

-- One active chair per club ---------------------------------------------
CREATE TRIGGER trg_cm_single_chair_insert
BEFORE INSERT ON club_members FOR EACH ROW
BEGIN
  IF NEW.member_role = 'chair' AND NEW.status = 'approved' AND EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = NEW.club_id AND member_role = 'chair' AND status = 'approved') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This club already has a chair';
  END IF;
END$$

CREATE TRIGGER trg_cm_single_chair_update
BEFORE UPDATE ON club_members FOR EACH ROW
BEGIN
  IF NEW.member_role = 'chair' AND NEW.status = 'approved' AND EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = NEW.club_id AND student_id <> NEW.student_id
        AND member_role = 'chair' AND status = 'approved') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This club already has a chair';
  END IF;
END$$

-- Permission helper: 0 none, 1 member, 2 core, 3 vice chair, 4 chair, 5 admin
-- The API calls this on every club-scoped write: SELECT fn_club_rank(?, ?)
CREATE FUNCTION fn_club_rank(p_club_id INT, p_user_id INT)
RETURNS TINYINT READS SQL DATA
BEGIN
  DECLARE v_global VARCHAR(10);
  DECLARE v_member VARCHAR(20);
  SELECT role INTO v_global FROM users WHERE user_id = p_user_id AND is_active = TRUE;
  IF v_global = 'admin' THEN RETURN 5; END IF;
  SELECT member_role INTO v_member FROM club_members
   WHERE club_id = p_club_id AND student_id = p_user_id AND status = 'approved';
  RETURN CASE v_member
           WHEN 'chair'       THEN 4
           WHEN 'vice_chair'  THEN 3
           WHEN 'core_member' THEN 2
           WHEN 'member'      THEN 1
           ELSE 0 END;
END$$

-- Grant / change a club role with the permission rules built in ---------
CREATE PROCEDURE sp_grant_club_role(
  IN p_club_id INT, IN p_student_id INT, IN p_new_role VARCHAR(20), IN p_acting_user INT)
BEGIN
  DECLARE v_actor TINYINT;
  DECLARE v_cur_role VARCHAR(20);
  DECLARE v_cur_status VARCHAR(20);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN ROLLBACK; RESIGNAL; END;

  IF p_new_role NOT IN ('member','core_member','vice_chair','chair') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid club role';
  END IF;

  SET v_actor = fn_club_rank(p_club_id, p_acting_user);

  START TRANSACTION;

  SELECT member_role, status INTO v_cur_role, v_cur_status
    FROM club_members WHERE club_id = p_club_id AND student_id = p_student_id FOR UPDATE;

  IF v_cur_status IS NULL OR v_cur_status <> 'approved' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student must be an approved club member first';
  END IF;

  IF p_new_role IN ('vice_chair','chair') OR v_cur_role IN ('vice_chair','chair') THEN
    IF v_actor < 5 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only an admin can change chair or vice chair roles';
    END IF;
  ELSEIF v_actor < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only a chair or vice chair can manage core members';
  END IF;

  -- appointing a new chair demotes the current one to core member
  IF p_new_role = 'chair' THEN
    UPDATE club_members
       SET member_role = 'core_member', granted_by = p_acting_user, role_granted_at = NOW()
     WHERE club_id = p_club_id AND member_role = 'chair' AND student_id <> p_student_id;
  END IF;

  UPDATE club_members
     SET member_role = p_new_role, granted_by = p_acting_user, role_granted_at = NOW()
   WHERE club_id = p_club_id AND student_id = p_student_id;

  COMMIT;
END$$

-- Conflict assistant: which events clash with a proposed slot? ----------
CREATE PROCEDURE sp_check_venue_conflicts(
  IN p_venue_id INT, IN p_start DATETIME, IN p_end DATETIME, IN p_exclude_event_id INT)
BEGIN
  SELECT e.event_id, e.title, c.name AS club, e.start_datetime, e.end_datetime, e.is_tentative
    FROM events e
    JOIN clubs c ON c.club_id = e.club_id
   WHERE e.venue_id = p_venue_id
     AND e.status <> 'cancelled'
     AND e.start_datetime < p_end
     AND e.end_datetime   > p_start
     AND (p_exclude_event_id IS NULL OR e.event_id <> p_exclude_event_id)
   ORDER BY e.start_datetime;
END$$

-- Conflict assistant: which venues are free for a slot? -----------------
CREATE PROCEDURE sp_free_venues(
  IN p_start DATETIME, IN p_end DATETIME, IN p_min_capacity INT)
BEGIN
  SELECT v.venue_id, v.name, v.location, v.capacity
    FROM venues v
   WHERE v.capacity >= IFNULL(p_min_capacity, 0)
     AND NOT EXISTS (
           SELECT 1 FROM events e
            WHERE e.venue_id = v.venue_id
              AND e.status <> 'cancelled'
              AND e.start_datetime < p_end
              AND e.end_datetime   > p_start)
   ORDER BY v.capacity;
END$$

-- Safe internal registration (transaction + row lock prevents overbooking)
CREATE PROCEDURE sp_register_student(IN p_event_id INT, IN p_student_id INT)
BEGIN
  DECLARE v_max INT; DECLARE v_deadline DATETIME;
  DECLARE v_status VARCHAR(20); DECLARE v_mode VARCHAR(20);
  DECLARE v_count INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;

  SELECT max_participants, registration_deadline, status, signup_mode
    INTO v_max, v_deadline, v_status, v_mode
    FROM events WHERE event_id = p_event_id FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event not found';
  ELSEIF v_mode <> 'internal' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This event does not use in-app registration';
  ELSEIF v_status <> 'scheduled' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event is not open for registration';
  ELSEIF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registration deadline has passed';
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM registrations
     WHERE event_id = p_event_id AND status = 'registered';
    IF v_count >= v_max THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event is full';
    END IF;
  END IF;

  INSERT INTO registrations (event_id, student_id) VALUES (p_event_id, p_student_id)
  ON DUPLICATE KEY UPDATE status = 'registered', registered_at = CURRENT_TIMESTAMP;

  COMMIT;
END$$

-- Moves events to ongoing/completed automatically.
-- Needs the scheduler on:  SET GLOBAL event_scheduler = ON;  (admin privilege)
CREATE EVENT ev_auto_update_event_status
ON SCHEDULE EVERY 15 MINUTE
DO
BEGIN
  UPDATE events SET status = 'completed'
   WHERE status IN ('scheduled','ongoing') AND end_datetime < NOW();
  UPDATE events SET status = 'ongoing'
   WHERE status = 'scheduled' AND start_datetime <= NOW() AND end_datetime >= NOW();
END$$

DELIMITER ;

-- =====================================================================
-- VIEWS (public ones never expose emails or password hashes)
-- =====================================================================
CREATE VIEW v_club_core_members AS            -- club page: core member cards
SELECT cm.club_id, cm.student_id, u.name, u.profile_photo_url,
       cm.member_role, cm.position_title, cm.display_order
FROM club_members cm
JOIN users u ON u.user_id = cm.student_id
WHERE cm.status = 'approved' AND cm.member_role <> 'member' AND u.is_active = TRUE;

CREATE VIEW v_upcoming_events AS              -- club page: next ~12 months
SELECT e.event_id, e.club_id, c.name AS club, e.title, e.description, e.event_type,
       e.start_datetime, e.end_datetime, e.is_tentative, e.poster_url,
       e.signup_mode, e.external_signup_url, e.registration_deadline,
       v.name AS venue
FROM events e
JOIN clubs c  ON c.club_id  = e.club_id
JOIN venues v ON v.venue_id = e.venue_id
WHERE e.status <> 'cancelled'
  AND e.end_datetime >= NOW()
  AND e.start_datetime < DATE_ADD(NOW(), INTERVAL 12 MONTH);

CREATE VIEW v_past_events AS                  -- memory page
SELECT e.event_id, e.club_id, c.name AS club, e.title, e.event_type,
       e.start_datetime, e.poster_url, e.recap_text,
       (SELECT COUNT(*) FROM event_photos p WHERE p.event_id = e.event_id) AS photo_count
FROM events e
JOIN clubs c ON c.club_id = e.club_id
WHERE e.status = 'completed' OR e.end_datetime < NOW();

CREATE VIEW v_event_participation AS
SELECT e.event_id, e.title, c.name AS club, e.max_participants,
       COUNT(CASE WHEN r.status='registered' THEN 1 END) AS registered,
       COUNT(CASE WHEN a.status='present' THEN 1 END)    AS attended,
       ROUND(100 * COUNT(CASE WHEN a.status='present' THEN 1 END)
             / NULLIF(COUNT(CASE WHEN r.status='registered' THEN 1 END),0), 1) AS attendance_pct
FROM events e
JOIN clubs c ON c.club_id = e.club_id
LEFT JOIN registrations r ON r.event_id = e.event_id
LEFT JOIN attendance a ON a.registration_id = r.registration_id
GROUP BY e.event_id, e.title, c.name, e.max_participants;

CREATE VIEW v_club_membership AS
SELECT c.club_id, c.name AS club, cat.name AS category,
       COUNT(CASE WHEN m.status='approved' THEN 1 END) AS approved_members,
       COUNT(CASE WHEN m.status='pending'  THEN 1 END) AS pending_requests
FROM clubs c
JOIN club_categories cat ON cat.category_id = c.category_id
LEFT JOIN club_members m ON m.club_id = c.club_id
GROUP BY c.club_id, c.name, cat.name;

CREATE VIEW v_student_history AS
SELECT s.student_id, u.name, s.roll_no, e.title AS event, e.start_datetime,
       r.status AS registration_status, a.status AS attendance, cert.certificate_code
FROM students s
JOIN users u ON u.user_id = s.student_id
JOIN registrations r ON r.student_id = s.student_id
JOIN events e ON e.event_id = r.event_id
LEFT JOIN attendance a ON a.registration_id = r.registration_id
LEFT JOIN certificates cert ON cert.registration_id = r.registration_id;

-- =====================================================================
-- SAMPLE DATA (password hashes are placeholders; the backend hashes real ones)
-- =====================================================================
INSERT INTO departments (name) VALUES ('Computer Engineering'),('Mechanical Engineering'),('Electronics');
INSERT INTO club_categories (name) VALUES ('Technical'),('Cultural'),('Sports'),('Academic');

INSERT INTO users (name,email,password_hash,role,profile_photo_url) VALUES
 ('Admin',       'admin@college.edu','CHANGE_ME','admin','/uploads/profiles/admin.jpg'),
 ('Prof. Mehta', 'mehta@college.edu','CHANGE_ME','user', NULL),
 ('Riya Shah',   'riya@college.edu', 'CHANGE_ME','user','/uploads/profiles/riya.jpg'),
 ('Aman Verma',  'aman@college.edu', 'CHANGE_ME','user','/uploads/profiles/aman.jpg'),
 ('Neha Patel',  'neha@college.edu', 'CHANGE_ME','user', NULL);

INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone) VALUES
 (3,'CE2021001',1,3,'9999999991'),
 (4,'CE2021002',1,3,'9999999992'),
 (5,'ME2022010',2,2,'9999999993');

INSERT INTO clubs (name,tagline,description,logo_url,website_url,category_id,faculty_advisor_id) VALUES
 ('Coding Club','Build. Break. Repeat.',
  'We run hackathons, workshops and weekly coding sessions for all skill levels.',
  '/uploads/logos/coding-club.png','https://codingclub.example.edu',1,2);

INSERT INTO club_members (club_id,student_id,member_role,position_title,display_order,status,granted_by,role_granted_at) VALUES
 (1,3,'chair',      'Chairperson',1,'approved',1,NOW()),
 (1,4,'core_member','Events Lead', 2,'approved',3,NOW()),
 (1,5,'member',      NULL,        100,'approved',NULL,NULL);

INSERT INTO venues (name,location,capacity) VALUES
 ('Seminar Hall','Main Building',150),
 ('Lab 3','CE Block',60);

-- one past event, one confirmed upcoming event, one tentative upcoming event
INSERT INTO events (club_id,venue_id,title,description,event_type,start_datetime,end_datetime,
                    is_tentative,signup_mode,external_signup_url,registration_deadline,max_participants,
                    status,recap_text,created_by) VALUES
 (1,1,'Hackathon 2026','24-hour build marathon.','technical',
  DATE_SUB(NOW(), INTERVAL 60 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 60 DAY), INTERVAL 8 HOUR),
  FALSE,'internal',NULL, DATE_SUB(NOW(), INTERVAL 67 DAY), 100,
  'completed','Over 80 students built 20 projects in one day.',3),
 (1,2,'Web Dev Workshop','Hands-on intro to React and Node.','workshop',
  DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 30 DAY), INTERVAL 3 HOUR),
  FALSE,'internal',NULL, DATE_ADD(NOW(), INTERVAL 25 DAY), 50,
  'scheduled',NULL,4),
 (1,1,'Annual Tech Fest','Dates to be confirmed.','technical',
  DATE_ADD(NOW(), INTERVAL 120 DAY), DATE_ADD(DATE_ADD(NOW(), INTERVAL 120 DAY), INTERVAL 10 HOUR),
  TRUE,'external','https://techfest.example.edu/signup', NULL, NULL,
  'scheduled',NULL,3);

INSERT INTO event_photos (event_id,image_url,thumbnail_url,caption,display_order,uploaded_by) VALUES
 (1,'/uploads/events/hackathon-1.jpg','/uploads/events/thumb-hackathon-1.jpg','Opening kickoff',1,3),
 (1,'/uploads/events/hackathon-2.jpg','/uploads/events/thumb-hackathon-2.jpg','Teams hard at work',2,4);

INSERT INTO registrations (event_id,student_id) VALUES (1,5);
INSERT INTO attendance (registration_id,status,marked_by) VALUES (1,'present',3);
INSERT INTO certificates (registration_id,certificate_code,certificate_type)
VALUES (1,'CERT-HACK26-0001','participation');