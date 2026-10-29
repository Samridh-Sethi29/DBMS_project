# College Club and Event Management System

Full-stack backend: **Node.js 20 + Express 4 + MySQL 8** (ES modules, mysql2/promise).

---

## File Tree

```
DBMS Project/
├── sql/
│   ├── schema.sql        ← Run first: DDL, base views (v_event_participation etc.)
│   ├── procedures.sql    ← Stored procedures (sp_insert_*, sp_update_*, sp_register_student …)
│   ├── accounts.sql      ← MySQL roles + users (role_naive / role_developer / role_dba)
│   ├── cursors.sql       ← sp_cursor_all, sp_cursor_batched
│   ├── functions.sql     ← fn_total_capacity, sp_search_events, sp_sum_grouped, sp_sum_column
│   ├── triggers.sql      ← All 20+ triggers (validation, audit, Monday block, uppercase)
│   ├── views.sql         ← v_computer_engineering_students + trigger-through-view demo
│   ├── indexes.sql       ← 4 performance indexes
│   └── perf_test.sql     ← 50 000-row seed + BEFORE/AFTER EXPLAIN ANALYZE
├── src/
│   ├── app.js            ← Express entry point
│   ├── config/
│   │   └── db.js         ← readPool (role_naive) + writePool (role_developer)
│   ├── middleware/
│   │   ├── auth.js       ← requireAuth, requireRole, signToken
│   │   ├── validate.js   ← Zod schema validation factory
│   │   ├── errorHandler.js ← MySQL error → HTTP status mapping
│   │   └── timing.js     ← process.hrtime.bigint() helpers
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   ├── students.js
│   │   ├── clubs.js
│   │   ├── venues.js
│   │   └── query.js      ← aggregate, join, subquery, correlated, dashboard, reports
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── eventsController.js
│   │   ├── studentsController.js
│   │   ├── clubsController.js
│   │   ├── venuesController.js
│   │   ├── aggregateController.js
│   │   ├── joinController.js
│   │   ├── subqueryController.js
│   │   ├── correlatedController.js
│   │   ├── dashboardController.js
│   │   └── reportsController.js
│   └── utils/
│       ├── xml.js         ← toXml() / sendXml()  (special-char escaping)
│       ├── pagination.js  ← parsePagination, paginated envelope
│       └── allowlists.js  ← ALL dynamic identifiers live here (SQL-injection prevention)
├── .env.example
└── package.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| MySQL | 8.0+ |
| npm | ≥ 9 |

---

## Setup

### 1 — Clone and install dependencies

```powershell
cd "DBMS Project"
npm install
```

### 2 — Create the database

```sql
-- In MySQL Workbench or mysql CLI as root:
CREATE DATABASE club_event_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3 — Run SQL files **in this exact order**

```powershell
# Replace root / password as needed
$M = "mysql -u root -p club_event_db"

Invoke-Expression "$M < sql\schema.sql"
Invoke-Expression "$M < sql\procedures.sql"
Invoke-Expression "$M < sql\accounts.sql"
Invoke-Expression "$M < sql\cursors.sql"
Invoke-Expression "$M < sql\functions.sql"
Invoke-Expression "$M < sql\triggers.sql"
Invoke-Expression "$M < sql\views.sql"
Invoke-Expression "$M < sql\indexes.sql"
# Optional – seeds 50 000 rows and runs EXPLAIN ANALYZE:
Invoke-Expression "$M < sql\perf_test.sql"
```

Or use the MySQL CLI directly:

```bash
mysql -u root -p club_event_db < sql/schema.sql
mysql -u root -p club_event_db < sql/procedures.sql
mysql -u root -p club_event_db < sql/accounts.sql
mysql -u root -p club_event_db < sql/cursors.sql
mysql -u root -p club_event_db < sql/functions.sql
mysql -u root -p club_event_db < sql/triggers.sql
mysql -u root -p club_event_db < sql/views.sql
mysql -u root -p club_event_db < sql/indexes.sql
mysql -u root -p club_event_db < sql/perf_test.sql
```

### 4 — Configure environment

```powershell
Copy-Item .env.example .env
# Edit .env – set DB_READ_PASS, DB_WRITE_PASS, JWT_SECRET
```

Key `.env` values:

| Key | Description |
|-----|-------------|
| `PORT` | HTTP port (default 3000) |
| `JWT_SECRET` | Min 64 random chars |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `8h`) |
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default 3306) |
| `DB_NAME` | `club_event_db` |
| `DB_READ_USER` | `user_naive` |
| `DB_READ_PASS` | `NaivePass#123` (change this) |
| `DB_WRITE_USER` | `user_developer` |
| `DB_WRITE_PASS` | `DevPass#456` (change this) |

### 5 — Start the server

```powershell
# Development (auto-restart on change, Node 20+):
npm run dev

# Production:
npm start
```

---

## npm Scripts

| Script | Command |
|--------|---------|
| `npm start` | `node src/app.js` |
| `npm run dev` | `node --watch src/app.js` |

---

## Environment Variable Summary

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<64+ random chars>
JWT_EXPIRES_IN=8h
DB_HOST=localhost
DB_PORT=3306
DB_NAME=club_event_db
DB_READ_USER=user_naive
DB_READ_PASS=NaivePass#123
DB_WRITE_USER=user_developer
DB_WRITE_PASS=DevPass#456
```

---

## curl Examples — Every Endpoint

> Replace `<TOKEN>` with the JWT returned by `/auth/login`.

### Auth

```bash
# Register
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@college.edu","password":"Secret#123","role":"coordinator"}'

# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@college.edu","password":"Secret#123"}'
```

---

### Q1 — GET /api/events (paginated, optional XML)

```bash
# JSON
curl "http://localhost:3000/api/events?page=1&pageSize=10"

# XML
curl "http://localhost:3000/api/events?page=1&pageSize=10&format=xml"
```

---

### Q2 — POST /api/events (create via sp_insert_event)

```bash
curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "club_id": 1,
    "venue_id": 1,
    "title": "Hackathon 2025",
    "description": "24-hour coding event",
    "event_type": "technical",
    "start_datetime": "2025-11-15T09:00:00",
    "end_datetime": "2025-11-16T09:00:00",
    "registration_deadline": "2025-11-10T23:59:00",
    "max_participants": 200
  }'
```

### POST /api/students (Q2 — student creation)

```bash
curl -s -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Bob Smith",
    "email": "bob@college.edu",
    "password_hash": "$2b$12$alreadyhashed_value_here",
    "roll_no": "CE2024001",
    "department_id": 1,
    "year_of_study": 2,
    "phone": "9876543210"
  }'
```

---

### Q3 — GET /api/aggregate (optional XML)

```bash
# COUNT registrations
curl "http://localhost:3000/api/aggregate?table=registrations&column=registration_id&fn=COUNT"

# SUM venue capacity
curl "http://localhost:3000/api/aggregate?table=venues&column=capacity&fn=SUM"

# AVG max_participants (XML output)
curl "http://localhost:3000/api/aggregate?table=events&column=max_participants&fn=AVG&format=xml"
```

---

### Q4 — GET /api/events/filter (optional XML)

```bash
# Events of type 'technical'
curl "http://localhost:3000/api/events/filter?field=event_type&op==&value=technical"

# Events with max_participants > 100
curl "http://localhost:3000/api/events/filter?field=max_participants&op=%3E&value=100"

# Events by status LIKE 'sched%'  (LIKE expands to %value%)
curl "http://localhost:3000/api/events/filter?field=status&op=LIKE&value=sched"

# BETWEEN dates
curl "http://localhost:3000/api/events/filter?field=start_datetime&op=BETWEEN&value=2025-01-01&value2=2025-12-31"

# XML output
curl "http://localhost:3000/api/events/filter?field=event_type&op==&value=workshop&format=xml"
```

---

### Q5 — GET /api/join

```bash
# INNER JOIN events + clubs
curl "http://localhost:3000/api/join?left=events&right=clubs&type=INNER&pageSize=5"

# LEFT JOIN registrations + students
curl "http://localhost:3000/api/join?left=registrations&right=students&type=LEFT"

# FULL OUTER (emulated via UNION)
curl "http://localhost:3000/api/join?left=events&right=venues&type=FULL"
```

---

### Q6 — GET /api/subquery

```bash
# Students registered for any event of club 1
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/subquery?option=students_in_club_events&club_id=1"

# Clubs with above-average approved membership
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/subquery?option=clubs_above_avg_membership"

# Events with no registrations at all
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/subquery?option=events_no_registrations"
```

---

### Q7 — GET /api/correlated

```bash
# Events whose registration count exceeds their club's average
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/correlated?option=events_above_club_avg"

# Students registered for more events than the average student
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/correlated?option=students_above_avg_events"
```

---

### Q8 — PUT /api/events/:id (update via sp_update_event)

```bash
curl -s -X PUT http://localhost:3000/api/events/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "venue_id": 2,
    "title": "Hackathon 2025 – Updated",
    "description": "48-hour marathon",
    "event_type": "technical",
    "start_datetime": "2025-11-15T09:00:00",
    "end_datetime": "2025-11-17T09:00:00",
    "registration_deadline": "2025-11-10T23:59:00",
    "max_participants": 150,
    "status": "scheduled"
  }'
```

---

### Dashboard

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/dashboard
```

---

### Reports (views)

```bash
# Participation report (v_event_participation)
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/participation?page=1&pageSize=20"

# Membership report (v_club_membership)
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/membership"

# Student history (v_student_history) for student_id = 22
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3000/api/reports/student/22"
```

---

### Business Endpoints

```bash
# Register student for an event (calls sp_register_student with row lock)
curl -s -X POST http://localhost:3000/api/events/1/register \
  -H "Authorization: Bearer <STUDENT_TOKEN>"

# Cancel registration
curl -s -X DELETE http://localhost:3000/api/events/1/register \
  -H "Authorization: Bearer <STUDENT_TOKEN>"

# Mark attendance
curl -s -X POST http://localhost:3000/api/events/1/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <COORDINATOR_TOKEN>" \
  -d '{"student_id": 22, "status": "present"}'

# Issue certificate (student must be present)
curl -s -X POST http://localhost:3000/api/events/1/certificates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <COORDINATOR_TOKEN>" \
  -d '{"student_id": 22, "certificate_type": "participation"}'
```

---

### CRUD — Clubs & Venues

```bash
# Create club (admin only)
curl -s -X POST http://localhost:3000/api/clubs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"name":"AI Club","description":"ML & AI","category_id":1,"coordinator_id":2}'

# Create venue (admin only)
curl -s -X POST http://localhost:3000/api/venues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"name":"Main Hall","location":"Block A","capacity":500}'

# Update venue
curl -s -X PUT http://localhost:3000/api/venues/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"name":"Auditorium A","location":"Block A","capacity":1000}'

# Delete venue (soft if events pending)
curl -s -X DELETE http://localhost:3000/api/venues/5 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

# List clubs
curl "http://localhost:3000/api/clubs?page=1&pageSize=5"

# Get single club
curl "http://localhost:3000/api/clubs/1"
```

---

### Health Check

```bash
curl http://localhost:3000/health
```

---

## Architecture Notes

| Concern | Implementation |
|---------|----------------|
| SQL injection | ALL identifiers (table/column/operator/join type) resolved from server-side `allowlists.js`; user input never interpolated |
| Parameterized queries | `namedPlaceholders: true`; every value bound via `?` or `:name` |
| MySQL error mapping | `errorHandler.js`: SIGNAL 45000 → 409/404, ER_DUP_ENTRY → 409, ER_NO_REFERENCED_ROW → 400 |
| Timing | `process.hrtime.bigint()` wraps every query; `executionTimeMs` in every response |
| Transaction safety | `conn.beginTransaction()` / `COMMIT` / `ROLLBACK` in finally; connection always released |
| Dual pools | `readPool` (role_naive) for GETs; `writePool` (role_developer) for mutations |
| XML | `utils/xml.js` escapes `& < > " '`; sent with `Content-Type: application/xml` |
| Pagination | `page` + `pageSize` (max 100) on every list endpoint |
| FULL OUTER JOIN | Emulated with `LEFT JOIN UNION RIGHT JOIN` (MySQL limitation) |
| Statement-level triggers | Not supported in MySQL – row-level triggers used; noted in `triggers.sql` |

---

**Assumption:** The `club_event_db` database already exists (CREATE DATABASE run manually or via mysql client before sourcing schema.sql); password-hashing in the `/auth/register` endpoint uses bcrypt with salt rounds = 12 in Node before calling `sp_user_register`.
