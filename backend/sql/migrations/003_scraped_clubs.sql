-- SVNIT scraped clubs, contacts, links, and clearly flagged placeholder events.
USE club_event_db;

ALTER TABLE clubs
  ADD COLUMN source_url VARCHAR(255) NULL UNIQUE,
  ADD COLUMN contact_email VARCHAR(120) NULL,
  ADD COLUMN scraped_at TIMESTAMP NULL;

ALTER TABLE events
  ADD COLUMN is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE club_links (
  link_id   INT AUTO_INCREMENT PRIMARY KEY,
  club_id   INT NOT NULL,
  platform  ENUM('website','facebook','twitter','instagram','linkedin','youtube','blog','other') NOT NULL,
  url       VARCHAR(255) NOT NULL,
  CONSTRAINT chk_club_link_url CHECK (url LIKE 'http://%' OR url LIKE 'https://%'),
  CONSTRAINT fk_club_link_club FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
  UNIQUE (club_id, url)
);

CREATE TABLE club_contacts (
  contact_id    INT AUTO_INCREMENT PRIMARY KEY,
  club_id       INT NOT NULL,
  person_name   VARCHAR(100) NOT NULL,
  designation   VARCHAR(100) NOT NULL,
  is_faculty    BOOLEAN NOT NULL,
  display_order SMALLINT NOT NULL,
  CONSTRAINT fk_club_contact_club FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

INSERT IGNORE INTO club_categories (name) VALUES ('Social Service'),('Literary');

CREATE OR REPLACE VIEW v_upcoming_events AS
SELECT e.event_id, e.club_id, c.name AS club, e.title, e.description, e.event_type,
       e.start_datetime, e.end_datetime, e.is_tentative, e.is_placeholder, e.poster_url,
       e.signup_mode, e.external_signup_url, e.registration_deadline,
       v.name AS venue
FROM events e
JOIN clubs c  ON c.club_id  = e.club_id
JOIN venues v ON v.venue_id = e.venue_id
WHERE e.status <> 'cancelled'
  AND e.end_datetime >= NOW()
  AND e.start_datetime < DATE_ADD(NOW(), INTERVAL 12 MONTH);

CREATE OR REPLACE VIEW v_past_events AS
SELECT e.event_id, e.club_id, c.name AS club, e.title, e.event_type,
       e.start_datetime, e.is_placeholder, e.poster_url, e.recap_text,
       (SELECT COUNT(*) FROM event_photos p WHERE p.event_id = e.event_id) AS photo_count
FROM events e
JOIN clubs c ON c.club_id = e.club_id
WHERE e.status = 'completed' OR e.end_datetime < NOW();
