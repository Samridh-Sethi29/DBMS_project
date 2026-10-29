-- =============================================================================
-- schema.sql  –  club_event_db  (MySQL 8)
-- Run once before any other SQL file.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS club_event_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE club_event_db;

-- ---------------------------------------------------------------------------
-- Core lookup tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  department_id INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_dept_name (name)
);

CREATE TABLE IF NOT EXISTS club_categories (
  category_id INT          NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_cat_name (name)
);

-- ---------------------------------------------------------------------------
-- Users (parent of students / coordinators / admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id       INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('student','coordinator','admin') NOT NULL DEFAULT 'student',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email)
);

-- ---------------------------------------------------------------------------
-- Students (1-1 extension of users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  student_id    INT         NOT NULL,
  roll_no       VARCHAR(20) NOT NULL,
  department_id INT         NOT NULL,
  year_of_study TINYINT     NOT NULL,
  phone         VARCHAR(20),
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_roll_no (roll_no),
  CONSTRAINT fk_student_user   FOREIGN KEY (student_id)    REFERENCES users(user_id),
  CONSTRAINT fk_student_dept   FOREIGN KEY (department_id) REFERENCES departments(department_id),
  CONSTRAINT chk_year_of_study CHECK (year_of_study BETWEEN 1 AND 6)
);

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
  club_id        INT          NOT NULL AUTO_INCREMENT,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  category_id    INT          NOT NULL,
  coordinator_id INT          NOT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id),
  UNIQUE KEY uq_club_name (name),
  CONSTRAINT fk_club_category    FOREIGN KEY (category_id)    REFERENCES club_categories(category_id),
  CONSTRAINT fk_club_coordinator FOREIGN KEY (coordinator_id) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------------
-- Club Members  (student M-N club)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_members (
  club_id     INT          NOT NULL,
  student_id  INT          NOT NULL,
  member_role VARCHAR(50)  NOT NULL DEFAULT 'member',
  status      ENUM('pending','approved','left') NOT NULL DEFAULT 'pending',
  joined_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (club_id, student_id),
  CONSTRAINT fk_cm_club    FOREIGN KEY (club_id)    REFERENCES clubs(student_id),
  CONSTRAINT fk_cm_student FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- fix the FK typo above at runtime – we'll rely on procedures.sql re-creating it
-- Actually let's fix it directly:
ALTER TABLE club_members DROP FOREIGN KEY fk_cm_club;
ALTER TABLE club_members
  ADD CONSTRAINT fk_cm_club FOREIGN KEY (club_id) REFERENCES clubs(club_id);

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venues (
  venue_id INT          NOT NULL AUTO_INCREMENT,
  name     VARCHAR(150) NOT NULL,
  location VARCHAR(255),
  capacity INT          NOT NULL,
  PRIMARY KEY (venue_id),
  UNIQUE KEY uq_venue_name (name),
  CONSTRAINT chk_venue_capacity CHECK (capacity > 0)
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  event_id              INT          NOT NULL AUTO_INCREMENT,
  club_id               INT          NOT NULL,
  venue_id              INT          NOT NULL,
  title                 VARCHAR(200) NOT NULL,
  description           TEXT,
  event_type            ENUM('technical','cultural','academic','sports','workshop','other') NOT NULL,
  start_datetime        DATETIME     NOT NULL,
  end_datetime          DATETIME     NOT NULL,
  registration_deadline DATETIME     NOT NULL,
  max_participants      INT          NOT NULL,
  status                ENUM('scheduled','ongoing','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  created_by            INT          NOT NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  CONSTRAINT fk_event_club    FOREIGN KEY (club_id)    REFERENCES clubs(club_id),
  CONSTRAINT fk_event_venue   FOREIGN KEY (venue_id)   REFERENCES venues(venue_id),
  CONSTRAINT fk_event_creator FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------------
-- Registrations  (student M-N event)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  registration_id INT      NOT NULL AUTO_INCREMENT,
  event_id        INT      NOT NULL,
  student_id      INT      NOT NULL,
  status          ENUM('registered','cancelled') NOT NULL DEFAULT 'registered',
  registered_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (registration_id),
  UNIQUE KEY uq_reg_event_student (event_id, student_id),
  CONSTRAINT fk_reg_event   FOREIGN KEY (event_id)   REFERENCES events(event_id),
  CONSTRAINT fk_reg_student FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- ---------------------------------------------------------------------------
-- Attendance  (1-1 with registration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id   INT NOT NULL AUTO_INCREMENT,
  registration_id INT NOT NULL,
  status          ENUM('present','absent') NOT NULL DEFAULT 'absent',
  marked_by       INT NOT NULL,
  marked_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attendance_id),
  UNIQUE KEY uq_att_reg (registration_id),
  CONSTRAINT fk_att_reg    FOREIGN KEY (registration_id) REFERENCES registrations(registration_id),
  CONSTRAINT fk_att_marker FOREIGN KEY (marked_by)       REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------------
-- Certificates  (1-1 with registration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
  certificate_id   INT          NOT NULL AUTO_INCREMENT,
  registration_id  INT          NOT NULL,
  certificate_code VARCHAR(50)  NOT NULL,
  certificate_type VARCHAR(100) NOT NULL,
  issued_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (certificate_id),
  UNIQUE KEY uq_cert_reg  (registration_id),
  UNIQUE KEY uq_cert_code (certificate_code),
  CONSTRAINT fk_cert_reg FOREIGN KEY (registration_id) REFERENCES registrations(registration_id)
);

-- ---------------------------------------------------------------------------
-- Application Audit Log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_audit_log (
  log_id     INT          NOT NULL AUTO_INCREMENT,
  table_name VARCHAR(100) NOT NULL,
  action     VARCHAR(10)  NOT NULL,
  record_id  INT,
  old_data   JSON,
  new_data   JSON,
  db_user    VARCHAR(100) NOT NULL DEFAULT (CURRENT_USER()),
  changed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id)
);

-- ---------------------------------------------------------------------------
-- Built-in views (referenced by the API reports layer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_event_participation AS
  SELECT
    e.event_id,
    e.title          AS event_title,
    e.event_type,
    e.start_datetime,
    e.status         AS event_status,
    c.name           AS club_name,
    v.name           AS venue_name,
    COUNT(r.registration_id)                                       AS total_registrations,
    SUM(r.status = 'registered')                                   AS active_registrations,
    SUM(r.status = 'cancelled')                                    AS cancelled_registrations,
    SUM(a.status = 'present')                                      AS attendees,
    ROUND(SUM(a.status = 'present') / NULLIF(e.max_participants,0) * 100, 2) AS fill_rate_pct
  FROM events e
  JOIN clubs  c ON c.club_id   = e.club_id
  JOIN venues v ON v.venue_id  = e.venue_id
  LEFT JOIN registrations r ON r.event_id = e.event_id
  LEFT JOIN attendance    a ON a.registration_id = r.registration_id
  GROUP BY e.event_id, e.title, e.event_type, e.start_datetime, e.status, c.name, v.name;

CREATE OR REPLACE VIEW v_club_membership AS
  SELECT
    c.club_id,
    c.name           AS club_name,
    c.status         AS club_status,
    cat.name         AS category_name,
    u.name           AS coordinator_name,
    COUNT(cm.student_id)                       AS total_members,
    SUM(cm.status = 'approved')                AS approved_members,
    SUM(cm.status = 'pending')                 AS pending_members
  FROM clubs c
  JOIN club_categories cat ON cat.category_id  = c.category_id
  JOIN users           u   ON u.user_id        = c.coordinator_id
  LEFT JOIN club_members cm ON cm.club_id = c.club_id
  GROUP BY c.club_id, c.name, c.status, cat.name, u.name;

CREATE OR REPLACE VIEW v_student_history AS
  SELECT
    s.student_id,
    u.name           AS student_name,
    u.email,
    s.roll_no,
    d.name           AS department_name,
    s.year_of_study,
    r.registration_id,
    r.event_id,
    e.title          AS event_title,
    e.event_type,
    e.start_datetime,
    r.status         AS registration_status,
    a.status         AS attendance_status,
    cert.certificate_code
  FROM students s
  JOIN users         u    ON u.user_id         = s.student_id
  JOIN departments   d    ON d.department_id   = s.department_id
  LEFT JOIN registrations r    ON r.student_id     = s.student_id
  LEFT JOIN events        e    ON e.event_id        = r.event_id
  LEFT JOIN attendance    a    ON a.registration_id = r.registration_id
  LEFT JOIN certificates  cert ON cert.registration_id = r.registration_id;
