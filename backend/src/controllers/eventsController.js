// src/controllers/eventsController.js
// Handles all /api/events endpoints (Q1, Q2, Q4, Q8, registration, attendance, certs).

import { readPool, writePool, getWriteConn } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { sendXml } from '../utils/xml.js';
import { badRequest, notFound } from '../middleware/errorHandler.js';
import { EVENT_FILTER_COLS, FILTER_OPS } from '../utils/allowlists.js';

// ── Q1: GET /api/events ──────────────────────────────────────────────────
export async function listEvents(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const { result, executionTimeMs } = await timed(async () => {
      const [[countRow]] = await readPool.execute(
        'SELECT COUNT(*) AS total FROM events'
      );
      const [rows] = await readPool.execute(
        `SELECT e.event_id, e.club_id, e.venue_id, e.title, e.description, e.event_type,
                e.start_datetime, e.end_datetime, e.is_tentative, e.is_placeholder, e.poster_url, e.recap_text,
                e.signup_mode, e.external_signup_url, e.registration_deadline,
                e.max_participants, e.status, e.created_at, e.updated_at,
                c.name AS club_name, v.name AS venue_name
         FROM events e
         JOIN clubs  c ON c.club_id  = e.club_id
         JOIN venues v ON v.venue_id = e.venue_id
         ORDER BY e.created_at DESC
         LIMIT ? OFFSET ?`,
        [pageSize, offset],
      );
      return { rows, total: countRow.total };
    });

    const payload = paginated({
      data: result.rows,
      total: result.total,
      page, pageSize,
      executionTimeMs,
    });

    if (req.query.format === 'xml') return sendXml(res, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ── Q2: POST /api/events ─────────────────────────────────────────────────
export async function createEvent(req, res, next) {
  let conn;
  try {
    const {
      club_id, venue_id, title, description = null, event_type,
      start_datetime, end_datetime,
      is_tentative = false, poster_url = null,
      signup_mode = 'none', external_signup_url = null,
      registration_deadline = null, max_participants = null,
    } = req.body;

    conn = await getWriteConn();
    const { result: eventId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_id = 0');
      await conn.execute(
        `CALL sp_insert_event(:club_id, :venue_id, :title, :description, :event_type,
          :start_datetime, :end_datetime, :is_tentative, :poster_url,
          :signup_mode, :external_signup_url, :registration_deadline,
          :max_participants, :created_by, @out_id)`,
        {
          club_id, venue_id, title, description, event_type,
          start_datetime, end_datetime, is_tentative, poster_url,
          signup_mode, external_signup_url, registration_deadline,
          max_participants, created_by: req.user.userId,
        },
      );
      const [[{ out_id }]] = await conn.execute('SELECT @out_id AS out_id');
      return out_id;
    });

    const [[newEvent]] = await readPool.execute(
      `SELECT e.*, c.name AS club_name, v.name AS venue_name
       FROM events e
       JOIN clubs c ON c.club_id = e.club_id
       JOIN venues v ON v.venue_id = e.venue_id
       WHERE e.event_id = ?`, [eventId]
    );

    res.status(201).json({
      data: newEvent,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// ── Q4: GET /api/events/filter ───────────────────────────────────────────
export async function filterEvents(req, res, next) {
  try {
    const { field, op, value, value2 } = req.query;
    const { page, pageSize, offset }   = parsePagination(req.query);

    if (!EVENT_FILTER_COLS.has(field)) {
      return next(badRequest(`field '${field}' is not filterable. Allowed: ${[...EVENT_FILTER_COLS].join(', ')}`));
    }
    if (!FILTER_OPS.has(op?.toUpperCase())) {
      return next(badRequest(`op '${op}' is not allowed. Allowed: ${[...FILTER_OPS].join(', ')}`));
    }
    if (value === undefined) {
      return next(badRequest('value is required.'));
    }

    const safeOp  = op.toUpperCase();
    const safeCol = `e.\`${field}\``;

    let whereSql, params;
    if (safeOp === 'BETWEEN') {
      if (value2 === undefined) return next(badRequest('value2 is required for BETWEEN.'));
      whereSql = `${safeCol} BETWEEN ? AND ?`;
      params   = [value, value2, pageSize, offset];
    } else if (safeOp === 'LIKE') {
      whereSql = `${safeCol} LIKE ?`;
      params   = [`%${value}%`, pageSize, offset];
    } else {
      whereSql = `${safeCol} ${safeOp} ?`;
      params   = [value, pageSize, offset];
    }

    const countParams = params.slice(0, params.length - 2);

    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute(
        `SELECT COUNT(*) AS total FROM events e WHERE ${whereSql}`,
        countParams,
      );
      const [rows] = await readPool.execute(
        `SELECT e.event_id, e.club_id, e.venue_id, e.title, e.description, e.event_type,
                e.start_datetime, e.end_datetime, e.is_tentative, e.is_placeholder, e.poster_url, e.recap_text,
                e.signup_mode, e.external_signup_url, e.registration_deadline,
                e.max_participants, e.status, e.created_at, e.updated_at,
                c.name AS club_name, v.name AS venue_name
         FROM events e
         JOIN clubs  c ON c.club_id  = e.club_id
         JOIN venues v ON v.venue_id = e.venue_id
         WHERE ${whereSql}
         ORDER BY e.start_datetime DESC
         LIMIT ? OFFSET ?`,
        params,
      );
      return { rows, total };
    });

    const payload = paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs });
    if (req.query.format === 'xml') return sendXml(res, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

// ── Q8: PUT /api/events/:id ──────────────────────────────────────────────
export async function updateEvent(req, res, next) {
  let conn;
  try {
    const eventId = parseInt(req.params.id, 10);
    const [[existing]] = await readPool.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
    if (!existing) return next(notFound('Event not found.'));

    const {
      venue_id              = existing.venue_id,
      title                 = existing.title,
      description           = existing.description,
      event_type            = existing.event_type,
      start_datetime        = existing.start_datetime,
      end_datetime          = existing.end_datetime,
      is_tentative          = existing.is_tentative,
      poster_url            = existing.poster_url,
      recap_text            = existing.recap_text,
      signup_mode           = existing.signup_mode,
      external_signup_url   = existing.external_signup_url,
      registration_deadline = existing.registration_deadline,
      max_participants      = existing.max_participants,
      status                = existing.status,
    } = req.body;

    conn = await getWriteConn();
    const { executionTimeMs } = await timed(() =>
      conn.execute(
        `CALL sp_update_event(:event_id, :venue_id, :title, :description, :event_type,
          :start_datetime, :end_datetime, :is_tentative, :poster_url, :recap_text,
          :signup_mode, :external_signup_url, :registration_deadline,
          :max_participants, :status)`,
        {
          event_id: eventId, venue_id, title, description, event_type,
          start_datetime, end_datetime, is_tentative, poster_url, recap_text,
          signup_mode, external_signup_url, registration_deadline,
          max_participants, status,
        },
      )
    );

    const [[updated]] = await readPool.execute(
      `SELECT e.*, c.name AS club_name, v.name AS venue_name
       FROM events e
       JOIN clubs  c ON c.club_id  = e.club_id
       JOIN venues v ON v.venue_id = e.venue_id
       WHERE e.event_id = ?`, [eventId]
    );

    res.json({
      data: updated,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// ── POST /events/:id/register ────────────────────────────────────────────
export async function registerForEvent(req, res, next) {
  let conn;
  try {
    const eventId   = parseInt(req.params.id, 10);
    const studentId = req.user.userId;

    conn = await getWriteConn();
    const { executionTimeMs } = await timed(async () => {
      // Calls schema.sql procedure sp_register_student(IN p_event_id INT, IN p_student_id INT)
      await conn.execute(
        'CALL sp_register_student(?, ?)',
        [eventId, studentId],
      );
    });

    const [[reg]] = await readPool.execute(
      'SELECT * FROM registrations WHERE event_id = ? AND student_id = ?',
      [eventId, studentId]
    );

    res.status(201).json({
      data: reg,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// ── DELETE /events/:id/register ──────────────────────────────────────────
export async function cancelRegistration(req, res, next) {
  let conn;
  try {
    const eventId   = parseInt(req.params.id, 10);
    const studentId = req.user.userId;

    conn = await getWriteConn();
    const { executionTimeMs } = await timed(async () => {
      await conn.beginTransaction();
      const [[reg]] = await conn.execute(
        'SELECT registration_id FROM registrations WHERE event_id = ? AND student_id = ? AND status = "registered" FOR UPDATE',
        [eventId, studentId],
      );
      if (!reg) throw Object.assign(new Error('Registration not found.'), { status: 404 });
      await conn.execute(
        'UPDATE registrations SET status = "cancelled" WHERE registration_id = ?',
        [reg.registration_id],
      );
      await conn.commit();
      return reg;
    });

    res.json({
      data: { cancelled: true },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch {}
    next(err);
  } finally {
    conn?.release();
  }
}

// ── POST /events/:id/attendance ──────────────────────────────────────────
export async function markAttendance(req, res, next) {
  let conn;
  try {
    const eventId = parseInt(req.params.id, 10);
    const { student_id, status = 'present' } = req.body;

    conn = await getWriteConn();
    const { result, executionTimeMs } = await timed(async () => {
      await conn.beginTransaction();
      const [[reg]] = await conn.execute(
        'SELECT registration_id FROM registrations WHERE event_id = ? AND student_id = ? AND status = "registered"',
        [eventId, student_id],
      );
      if (!reg) throw Object.assign(new Error('Active registration not found.'), { status: 404 });

      const [existing] = await conn.execute(
        'SELECT attendance_id FROM attendance WHERE registration_id = ?',
        [reg.registration_id],
      );

      let attId;
      if (existing.length) {
        await conn.execute(
          'UPDATE attendance SET status = ?, marked_by = ?, marked_at = NOW() WHERE registration_id = ?',
          [status, req.user.userId, reg.registration_id],
        );
        attId = existing[0].attendance_id;
      } else {
        const [ins] = await conn.execute(
          'INSERT INTO attendance (registration_id, status, marked_by) VALUES (?, ?, ?)',
          [reg.registration_id, status, req.user.userId],
        );
        attId = ins.insertId;
      }
      await conn.commit();
      return attId;
    });

    const [[att]] = await readPool.execute(
      'SELECT * FROM attendance WHERE attendance_id = ?', [result]
    );
    res.status(201).json({
      data: att,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch {}
    next(err);
  } finally {
    conn?.release();
  }
}

// ── POST /events/:id/certificates ────────────────────────────────────────
export async function issueCertificate(req, res, next) {
  let conn;
  try {
    const eventId = parseInt(req.params.id, 10);
    const { student_id, certificate_type = 'participation' } = req.body;

    conn = await getWriteConn();
    const { result, executionTimeMs } = await timed(async () => {
      await conn.beginTransaction();
      const [[reg]] = await conn.execute(
        `SELECT r.registration_id
         FROM registrations r
         JOIN attendance a ON a.registration_id = r.registration_id
         WHERE r.event_id = ? AND r.student_id = ?
           AND r.status = 'registered' AND a.status = 'present'`,
        [eventId, student_id],
      );
      if (!reg) throw Object.assign(new Error('No present attendance record found for this student/event.'), { status: 404 });

      const [[existing]] = await conn.execute(
        'SELECT certificate_id FROM certificates WHERE registration_id = ?',
        [reg.registration_id],
      );
      if (existing) throw Object.assign(new Error('Certificate already issued.'), { status: 409 });

      const code = `CERT-${eventId}-${student_id}-${Date.now()}`;
      const [ins] = await conn.execute(
        'INSERT INTO certificates (registration_id, certificate_code, certificate_type) VALUES (?, ?, ?)',
        [reg.registration_id, code, certificate_type],
      );
      await conn.commit();
      return ins.insertId;
    });

    const [[cert]] = await readPool.execute(
      'SELECT * FROM certificates WHERE certificate_id = ?', [result]
    );
    res.status(201).json({
      data: cert,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    if (conn) try { await conn.rollback(); } catch {}
    next(err);
  } finally {
    conn?.release();
  }
}
