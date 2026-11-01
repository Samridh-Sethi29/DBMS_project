import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readPool, writePool, getWriteConn } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { badRequest, forbidden, notFound } from '../middleware/errorHandler.js';

const controllerDir = path.dirname(fileURLToPath(import.meta.url));
const backendUploadsRoot = path.resolve(controllerDir, '../../uploads');

function stripHtml(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '').trim();
}

function escapeLike(str = '') {
  return String(str).replace(/[\\%_]/g, '\\$&');
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toMySqlDateTime(value) {
  if (!value) return value ?? null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeConflictRows(rows, clubId) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    const payload = {
      clubId: row.club_id ? Number(row.club_id) : null,
      club: row.club,
      venueId: row.venue_id ? Number(row.venue_id) : null,
      venueName: row.venue_name || row.venue || null,
      startDatetime: row.start_datetime ? new Date(row.start_datetime).toISOString() : null,
      endDatetime: row.end_datetime ? new Date(row.end_datetime).toISOString() : null,
      severity: row.severity || 'hard',
      eventId: row.event_id ? Number(row.event_id) : null,
      title: row.title || null,
      isTentative: row.is_tentative !== undefined ? Boolean(row.is_tentative) : false,
    };
    return payload;
  });
}

function extractProcedureRows(resultTuple) {
  if (!Array.isArray(resultTuple)) return [];
  const rows = Array.isArray(resultTuple[0]) ? resultTuple[0] : [];
  return rows;
}

async function getSoftScheduleConflicts({ venueId, start, end, excludeEventId = null }) {
  const startValue = toMySqlDateTime(start);
  const endValue = toMySqlDateTime(end);
  const [rows] = await readPool.execute(
    `SELECT e.event_id, e.title, e.club_id, c.name AS club, e.venue_id, v.name AS venue_name,
            e.start_datetime, e.end_datetime, e.is_tentative
     FROM events e
     JOIN clubs c ON c.club_id = e.club_id
     JOIN venues v ON v.venue_id = e.venue_id
     WHERE e.status <> 'cancelled'
       AND e.venue_id <> ?
       AND e.start_datetime < ?
       AND e.end_datetime > ?
       AND (? IS NULL OR e.event_id <> ?)
     ORDER BY e.start_datetime`,
    [venueId, endValue, startValue, excludeEventId, excludeEventId],
  );
  return rows;
}

function toIso(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export async function joinClub(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    if (!clubId) return next(badRequest('Club ID is required.'));

    const [[student]] = await readPool.execute('SELECT student_id FROM students WHERE student_id = ? AND student_id IS NOT NULL', [req.user.userId]);
    if (!student && req.user.role !== 'admin') {
      return next(badRequest('You must create a student profile before joining clubs.', 'VALIDATION_ERROR'));
    }
    if (!student && req.user.role === 'admin') {
      await writePool.execute(
        `INSERT INTO students (student_id, roll_no, department_id, year_of_study, phone)
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE
           roll_no = VALUES(roll_no),
           department_id = VALUES(department_id),
           year_of_study = VALUES(year_of_study)`,
        [req.user.userId, `ADMIN-${req.user.userId}`, 1, 1],
      );
    }

    const [[club]] = await readPool.execute('SELECT club_id, status FROM clubs WHERE club_id = ? AND status = ?', [clubId, 'active']);
    if (!club) return next(notFound('Club not found.'));

    const [existingRows] = await readPool.execute(
      'SELECT * FROM club_members WHERE club_id = ? AND student_id = ?',
      [clubId, req.user.userId],
    );

    const autoApproved = req.user.role === 'admin';
    const nextStatus = autoApproved ? 'approved' : 'pending';
    const nextRole = 'member';

    if (existingRows.length && ['pending', 'approved'].includes(existingRows[0].status)) {
      if (autoApproved) {
        const [updated] = await writePool.execute(
          'UPDATE club_members SET status = ?, member_role = ?, granted_by = ?, role_granted_at = NOW() WHERE club_id = ? AND student_id = ?',
          [nextStatus, nextRole, req.user.userId, clubId, req.user.userId],
        );
        return res.json({
          data: { clubId, studentId: req.user.userId, status: nextStatus, role: nextRole, updated: updated.affectedRows > 0 },
          meta: { rowCount: 1, executionTimeMs: 0 },
        });
      }
      return res.status(409).json({ error: { code: 'CLUB_REQUEST_EXISTS', message: 'You already have a pending or approved membership request.' } });
    }

    if (existingRows.length && existingRows[0].status === 'left') {
      const [updated] = await writePool.execute(
        'UPDATE club_members SET status = ?, member_role = ?, granted_by = ?, role_granted_at = NOW() WHERE club_id = ? AND student_id = ?',
        [nextStatus, nextRole, autoApproved ? req.user.userId : null, clubId, req.user.userId],
      );
      return res.json({
        data: { clubId, studentId: req.user.userId, status: nextStatus, role: nextRole, updated: updated.affectedRows > 0 },
        meta: { rowCount: 1, executionTimeMs: 0 },
      });
    }

    const [result] = await writePool.execute(
      'INSERT INTO club_members (club_id, student_id, member_role, status, granted_by, role_granted_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [clubId, req.user.userId, nextRole, nextStatus, autoApproved ? req.user.userId : null],
    );

    res.status(201).json({
      data: { clubId, studentId: req.user.userId, status: nextStatus, role: nextRole, membershipId: result.insertId },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function leaveClub(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    if (!clubId) return next(badRequest('Club ID is required.'));

    const [result] = await writePool.execute(
      'UPDATE club_members SET status = ?, member_role = ? WHERE club_id = ? AND student_id = ? AND status <> ?',
      ['left', 'member', clubId, req.user.userId, 'left'],
    );

    if (!result.affectedRows) {
      return next(notFound('Membership not found.'));
    }

    res.json({ data: { clubId, studentId: req.user.userId, status: 'left', role: 'member' }, meta: { rowCount: 1, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function getMyMemberships(req, res, next) {
  try {
    const [rows] = await readPool.execute(
      `SELECT cm.club_id AS clubId, c.name, c.logo_url AS logoUrl,
              cm.member_role AS role, cm.status,
              fn_club_rank(cm.club_id, ?) AS club_rank
       FROM club_members cm
       JOIN clubs c ON c.club_id = cm.club_id
       WHERE cm.student_id = ? AND cm.status IN ('pending', 'approved')
       ORDER BY c.name`,
      [req.user.userId, req.user.userId],
    );

    res.json({
      data: rows.map(row => ({
        clubId: Number(row.clubId),
        name: row.name,
        logoUrl: row.logoUrl,
        role: row.role,
        status: row.status,
        rank: Number(row.club_rank),
      })),
      meta: { rowCount: rows.length, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function listClubMembers(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const status = req.query.status && req.query.status !== 'all' ? String(req.query.status) : null;
    const { page, pageSize, offset } = parsePagination(req.query);

    const where = ['cm.club_id = ?'];
    const params = [clubId];
    if (status) {
      where.push('cm.status = ?');
      params.push(status);
    }

    const [countRows] = await readPool.execute(
      `SELECT COUNT(*) AS total FROM club_members cm ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
      params,
    );

    const [rows] = await readPool.execute(
      `SELECT cm.student_id AS studentId, u.name, s.roll_no AS rollNo,
              cm.member_role AS role, cm.position_title AS positionTitle,
              cm.display_order AS displayOrder, cm.status, cm.joined_at AS joinedAt
       FROM club_members cm
       JOIN students s ON s.student_id = cm.student_id
       JOIN users u ON u.user_id = s.student_id
       WHERE ${where.join(' AND ')}
       ORDER BY cm.status = 'pending' DESC, cm.display_order, u.name
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    res.json(paginated({
      data: rows.map(row => ({
        studentId: Number(row.studentId),
        name: row.name,
        rollNo: row.rollNo,
        role: row.role,
        positionTitle: row.positionTitle,
        displayOrder: row.displayOrder,
        status: row.status,
        joinedAt: row.joinedAt ? new Date(row.joinedAt).toISOString() : null,
      })),
      total: Number(countRows[0].total),
      page,
      pageSize,
      executionTimeMs: 0,
    }));
  } catch (err) {
    next(err);
  }
}

export async function updateMemberStatus(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const studentId = Number(req.params.studentId);
    const requestedStatus = String(req.body.status || '').toLowerCase();
    if (!['approved', 'left'].includes(requestedStatus)) {
      return next(badRequest('status must be approved or left.', 'VALIDATION_ERROR'));
    }

    const [memberRows] = await readPool.execute(
      'SELECT * FROM club_members WHERE club_id = ? AND student_id = ?',
      [clubId, studentId],
    );
    const member = memberRows[0];
    if (!member) return next(notFound('Club membership not found.'));

    if (requestedStatus === 'approved' && member.status !== 'pending') {
      return res.status(409).json({ error: { code: 'INVALID_MEMBER_STATUS', message: 'Only pending members can be approved.' } });
    }
    if (requestedStatus === 'left' && !['pending', 'approved'].includes(member.status)) {
      return res.status(409).json({ error: { code: 'INVALID_MEMBER_STATUS', message: 'Only pending or approved members can leave.' } });
    }

    const [result] = await writePool.execute(
      'UPDATE club_members SET status = ?, member_role = ? WHERE club_id = ? AND student_id = ?',
      [requestedStatus, requestedStatus === 'left' ? 'member' : member.member_role, clubId, studentId],
    );

    res.json({
      data: { clubId, studentId, status: requestedStatus, role: requestedStatus === 'left' ? 'member' : member.member_role, updated: result.affectedRows > 0 },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMemberRole(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const studentId = Number(req.params.studentId);
    const role = String(req.body.role || '');
    const positionTitle = String(req.body.positionTitle ?? '').slice(0, 60);
    const displayOrder = Number(req.body.displayOrder ?? 100);

    if (!['member', 'core_member', 'vice_chair', 'chair'].includes(role)) {
      return next(badRequest('role must be one of member, core_member, vice_chair, chair.', 'VALIDATION_ERROR'));
    }
    if (positionTitle.length > 60) {
      return next(badRequest('positionTitle must be at most 60 characters.', 'VALIDATION_ERROR'));
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 1000) {
      return next(badRequest('displayOrder must be an integer from 1 to 1000.', 'VALIDATION_ERROR'));
    }

    const conn = await getWriteConn();
    try {
      await conn.beginTransaction();
      await conn.execute('CALL sp_grant_club_role(?, ?, ?, ?)', [clubId, studentId, role, req.user.userId]);
      await conn.execute(
        'UPDATE club_members SET position_title = ?, display_order = ? WHERE club_id = ? AND student_id = ?',
        [positionTitle || null, displayOrder, clubId, studentId],
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [[member]] = await readPool.execute(
      'SELECT member_role AS role, position_title AS positionTitle, display_order AS displayOrder FROM club_members WHERE club_id = ? AND student_id = ?',
      [clubId, studentId],
    );

    res.json({
      data: { clubId, studentId, role: member.role, positionTitle: member.positionTitle, displayOrder: member.displayOrder },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdminStudents(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = String(req.query.search || '').trim();
    const escaped = escapeLike(search);

    const where = ['u.is_active = 1'];
    const params = [];
    if (search) {
      where.push('(u.name LIKE ? OR s.roll_no LIKE ? OR d.name LIKE ?)');
      params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }

    const [countRows] = await readPool.execute(
      `SELECT COUNT(*) AS total FROM students s
       JOIN users u ON u.user_id = s.student_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE ${where.join(' AND ')}`,
      params,
    );

    const [rows] = await readPool.execute(
      `SELECT s.student_id AS studentId, u.name, s.roll_no AS rollNo, d.name AS department
       FROM students s
       JOIN users u ON u.user_id = s.student_id
       LEFT JOIN departments d ON d.department_id = s.department_id
       WHERE ${where.join(' AND ')}
       ORDER BY u.name LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    res.json(paginated({
      data: rows.map(row => ({ studentId: Number(row.studentId), name: row.name, rollNo: row.rollNo, department: row.department })),
      total: Number(countRows[0].total),
      page,
      pageSize,
      executionTimeMs: 0,
    }));
  } catch (err) {
    next(err);
  }
}

export async function createAdminClubMember(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const studentId = Number(req.body.studentId);
    const role = String(req.body.role || '');

    if (!clubId || !studentId) return next(badRequest('studentId is required.'));
    if (!['member', 'core_member', 'vice_chair', 'chair'].includes(role)) {
      return next(badRequest('role must be one of member, core_member, vice_chair, chair.', 'VALIDATION_ERROR'));
    }

    const [[club]] = await readPool.execute('SELECT club_id FROM clubs WHERE club_id = ?', [clubId]);
    if (!club) return next(notFound('Club not found.'));

    const [[student]] = await readPool.execute('SELECT student_id FROM students WHERE student_id = ?', [studentId]);
    if (!student) return next(notFound('Student not found.'));

    const conn = await getWriteConn();
    try {
      await conn.beginTransaction();
      const [memberRows] = await conn.execute('SELECT * FROM club_members WHERE club_id = ? AND student_id = ? FOR UPDATE', [clubId, studentId]);
      if (!memberRows.length) {
        await conn.execute(
          'INSERT INTO club_members (club_id, student_id, member_role, status, granted_by, role_granted_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [clubId, studentId, 'member', 'approved', req.user.userId],
        );
      } else if (memberRows[0].status !== 'approved') {
        await conn.execute(
          'UPDATE club_members SET status = ?, member_role = ?, granted_by = ?, role_granted_at = NOW() WHERE club_id = ? AND student_id = ?',
          ['approved', 'member', req.user.userId, clubId, studentId],
        );
      }
      await conn.execute('CALL sp_grant_club_role(?, ?, ?, ?)', [clubId, studentId, role, req.user.userId]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.status(201).json({
      data: { clubId, studentId, role },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdminClubs(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const [countRows] = await readPool.execute('SELECT COUNT(*) AS total FROM clubs');

    const [rows] = await readPool.execute(
      `SELECT c.club_id AS clubId, c.name,
              (SELECT u.name FROM club_members cm JOIN users u ON u.user_id = cm.student_id WHERE cm.club_id = c.club_id AND cm.status = 'approved' AND cm.member_role = 'chair' LIMIT 1) AS chairName,
              (SELECT u.name FROM club_members cm JOIN users u ON u.user_id = cm.student_id WHERE cm.club_id = c.club_id AND cm.status = 'approved' AND cm.member_role = 'vice_chair' LIMIT 1) AS viceChairName,
              (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.club_id AND cm.status = 'approved') AS memberCount,
              (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.club_id AND cm.status = 'pending') AS pendingCount,
              (SELECT COUNT(*) FROM events e WHERE e.club_id = c.club_id AND e.status <> 'cancelled' AND e.start_datetime >= NOW()) AS upcomingEvents
       FROM clubs c
       ORDER BY c.name
       LIMIT ? OFFSET ?`,
      [pageSize, offset],
    );

    res.json(paginated({
      data: rows.map(row => ({
        clubId: Number(row.clubId),
        name: row.name,
        chairName: row.chairName || null,
        viceChairName: row.viceChairName || null,
        memberCount: Number(row.memberCount || 0),
        pendingCount: Number(row.pendingCount || 0),
        upcomingEvents: Number(row.upcomingEvents || 0),
      })),
      total: Number(countRows[0].total),
      page,
      pageSize,
      executionTimeMs: 0,
    }));
  } catch (err) {
    next(err);
  }
}

export async function createClubEvent(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const body = req.body;
    const now = new Date();
    const startDate = toMySqlDateTime(body.startDatetime);
    const endDate = toMySqlDateTime(body.endDatetime);
    const registrationDeadline = body.registrationDeadline ? toMySqlDateTime(body.registrationDeadline) : null;

    if (!body.venueId) return next(badRequest('venueId is required.'));
    if (!body.title || String(body.title).trim().length < 3) return next(badRequest('title must be at least 3 characters.', 'VALIDATION_ERROR'));
    if (!startDate || !endDate) return next(badRequest('startDatetime and endDatetime are required.'));
    if (new Date(endDate) <= new Date(startDate)) return next(badRequest('endDatetime must be after startDatetime.', 'VALIDATION_ERROR'));
    if (registrationDeadline && new Date(registrationDeadline) > new Date(startDate)) return next(badRequest('registrationDeadline must be on or before startDatetime.', 'VALIDATION_ERROR'));
    if (body.signupMode === 'external' && (!body.externalSignupUrl || !/^https?:\/\//.test(String(body.externalSignupUrl)))) return next(badRequest('externalSignupUrl is required for external signup.', 'VALIDATION_ERROR'));
    if (body.signupMode === 'internal' && (!body.maxParticipants || Number(body.maxParticipants) <= 0)) return next(badRequest('maxParticipants is required for internal signup.', 'VALIDATION_ERROR'));
    if (body.posterUrl && !/^https?:\/\//.test(String(body.posterUrl))) return next(badRequest('posterUrl must be a valid http(s) URL.', 'VALIDATION_ERROR'));

    const [[venue]] = await readPool.execute('SELECT capacity FROM venues WHERE venue_id = ?', [body.venueId]);
    if (!venue) return next(notFound('Venue not found.'));
    if (body.maxParticipants && Number(body.maxParticipants) > Number(venue.capacity)) {
      return next(badRequest('maxParticipants may not exceed venue capacity.', 'VALIDATION_ERROR'));
    }

    const conflictResult = await readPool.execute(
      'CALL sp_check_venue_conflicts(?, ?, ?, ?)',
      [body.venueId, startDate, endDate, null],
    );
    const hardConflictRows = extractProcedureRows(conflictResult[0]);
    const softConflictRows = await getSoftScheduleConflicts({
      venueId: body.venueId,
      start: startDate,
      end: endDate,
      excludeEventId: null,
    });

    if (hardConflictRows.length) {
      const conflictPayload = normalizeConflictRows(hardConflictRows, clubId);
      return res.status(409).json({
        error: {
          code: 'VENUE_CONFLICT',
          message: 'Hard venue conflict: this venue is already booked for the selected time slot.',
          conflicts: conflictPayload,
        },
      });
    }

    const status = new Date(endDate) < now ? 'completed' : 'scheduled';
    const insert = await writePool.execute(
      `INSERT INTO events (
        club_id, venue_id, title, description, event_type, start_datetime, end_datetime,
        is_tentative, is_placeholder, poster_url, signup_mode, external_signup_url,
        registration_deadline, max_participants, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clubId,
        body.venueId,
        body.title,
        body.description ?? null,
        body.eventType || 'other',
        startDate,
        endDate,
        body.isTentative ? 1 : 0,
        body.isPlaceholder ? 1 : 0,
        body.posterUrl ?? null,
        body.signupMode || 'none',
        body.externalSignupUrl ?? null,
        registrationDeadline,
        body.maxParticipants ?? null,
        status,
        req.user.userId,
      ],
    );

    const [rows] = await readPool.execute('SELECT * FROM events WHERE event_id = ?', [insert[0].insertId]);
    const event = rows[0];
    const softConflictPayload = normalizeConflictRows(softConflictRows, clubId).map(conflict => ({ ...conflict, severity: 'soft' }));
    res.status(201).json({
      data: {
        ...event,
        startDatetime: event.start_datetime ? toIso(event.start_datetime) : null,
        endDatetime: event.end_datetime ? toIso(event.end_datetime) : null,
        softConflict: softConflictRows.length > 0,
        softConflicts: softConflictPayload,
      },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClubEvent(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const [eventRows] = await readPool.execute('SELECT * FROM events WHERE event_id = ? AND club_id = ?', [eventId, clubId]);
    if (!eventRows.length) return next(notFound('Event not found.'));
    const event = eventRows[0];
    const body = req.body || {};

    if (body.startDatetime || body.endDatetime) {
      const hasDateChange = !!(body.startDatetime && new Date(body.startDatetime).getTime() !== new Date(event.start_datetime).getTime()) || !!(body.endDatetime && new Date(body.endDatetime).getTime() !== new Date(event.end_datetime).getTime());
      if (['cancelled', 'completed'].includes(event.status) && hasDateChange) {
        return res.status(409).json({ error: { code: 'EVENT_LOCKED', message: 'Cancelled or completed events cannot change dates.' } });
      }
      if (event.is_placeholder && body.confirmDate === true) {
        body.isPlaceholder = false;
        body.isTentative = body.isTentative ?? false;
      }
    }

    const updated = {
      venue_id: body.venueId ?? event.venue_id,
      title: body.title ?? event.title,
      description: body.description ?? event.description,
      event_type: body.eventType ?? event.event_type,
      start_datetime: body.startDatetime ?? event.start_datetime,
      end_datetime: body.endDatetime ?? event.end_datetime,
      is_tentative: body.isTentative ?? event.is_tentative,
      poster_url: body.posterUrl ?? event.poster_url,
      recap_text: body.recapText ?? event.recap_text,
      signup_mode: body.signupMode ?? event.signup_mode,
      external_signup_url: body.externalSignupUrl ?? event.external_signup_url,
      registration_deadline: body.registrationDeadline ?? event.registration_deadline,
      max_participants: body.maxParticipants ?? event.max_participants,
      status: body.status ?? event.status,
      is_placeholder: body.isPlaceholder ?? event.is_placeholder,
    };

    updated.start_datetime = toMySqlDateTime(updated.start_datetime);
    updated.end_datetime = toMySqlDateTime(updated.end_datetime);
    updated.registration_deadline = updated.registration_deadline ? toMySqlDateTime(updated.registration_deadline) : null;

    if (updated.end_datetime <= updated.start_datetime) {
      return next(badRequest('endDatetime must be after startDatetime.', 'VALIDATION_ERROR'));
    }
    if (updated.registration_deadline && new Date(updated.registration_deadline) > new Date(updated.start_datetime)) {
      return next(badRequest('registrationDeadline must be on or before startDatetime.', 'VALIDATION_ERROR'));
    }
    if (updated.signup_mode === 'external' && (!updated.external_signup_url || !/^https?:\/\//.test(String(updated.external_signup_url)))) {
      return next(badRequest('externalSignupUrl is required for external signup.', 'VALIDATION_ERROR'));
    }
    if (updated.signup_mode === 'internal' && (!updated.max_participants || Number(updated.max_participants) <= 0)) {
      return next(badRequest('maxParticipants is required for internal signup.', 'VALIDATION_ERROR'));
    }
    if (updated.max_participants && Number(updated.max_participants) > Number((await readPool.execute('SELECT capacity FROM venues WHERE venue_id = ?', [updated.venue_id]))[0][0].capacity)) {
      return next(badRequest('maxParticipants may not exceed venue capacity.', 'VALIDATION_ERROR'));
    }

    const conflictResult = await readPool.execute(
      'CALL sp_check_venue_conflicts(?, ?, ?, ?)',
      [updated.venue_id, updated.start_datetime, updated.end_datetime, eventId],
    );
    const hardConflictRows = extractProcedureRows(conflictResult[0]);
    if (hardConflictRows.length) {
      const conflicts = normalizeConflictRows(hardConflictRows, clubId);
      return res.status(409).json({ error: { code: 'VENUE_CONFLICT', message: 'Hard venue conflict: this venue is already booked for the selected time slot.', conflicts } });
    }

    const softConflictRows = await getSoftScheduleConflicts({
      venueId: updated.venue_id,
      start: updated.start_datetime,
      end: updated.end_datetime,
      excludeEventId: eventId,
    });

    await writePool.execute(
      `UPDATE events SET venue_id = ?, title = ?, description = ?, event_type = ?, start_datetime = ?, end_datetime = ?, is_tentative = ?, is_placeholder = ?, poster_url = ?, recap_text = ?, signup_mode = ?, external_signup_url = ?, registration_deadline = ?, max_participants = ?, status = ? WHERE event_id = ?`,
      [updated.venue_id, updated.title, updated.description, updated.event_type, updated.start_datetime, updated.end_datetime, updated.is_tentative ? 1 : 0, updated.is_placeholder ? 1 : 0, updated.poster_url, updated.recap_text, updated.signup_mode, updated.external_signup_url, updated.registration_deadline, updated.max_participants, updated.status, eventId],
    );

    const [rows] = await readPool.execute('SELECT * FROM events WHERE event_id = ?', [eventId]);
    const eventResponse = rows[0];
    const softConflictPayload = normalizeConflictRows(softConflictRows, clubId).map(conflict => ({ ...conflict, severity: 'soft' }));
    res.json({
      data: {
        ...eventResponse,
        startDatetime: eventResponse.start_datetime ? toIso(eventResponse.start_datetime) : null,
        endDatetime: eventResponse.end_datetime ? toIso(eventResponse.end_datetime) : null,
        softConflict: softConflictRows.length > 0,
        softConflicts: softConflictPayload,
      },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelClubEvent(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const confirm = Boolean(req.body?.confirm === true);

    const [eventRows] = await readPool.execute('SELECT * FROM events WHERE event_id = ? AND club_id = ?', [eventId, clubId]);
    if (!eventRows.length) return next(notFound('Event not found.'));

    const [regRows] = await readPool.execute('SELECT COUNT(*) AS total FROM registrations WHERE event_id = ?', [eventId]);
    if (Number(regRows[0].total) > 0 && !confirm) {
      return res.status(409).json({ error: { code: 'EVENT_HAS_REGISTRATIONS', message: 'This event has registrations. Confirm cancellation to proceed.' } });
    }

    await writePool.execute('UPDATE events SET status = ? WHERE event_id = ? AND club_id = ?', ['cancelled', eventId, clubId]);
    res.json({ data: { eventId, status: 'cancelled' }, meta: { rowCount: 1, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function checkVenueConflicts(req, res, next) {
  try {
    const clubId = Number(req.body.clubId ?? req.query.clubId);
    const venueId = Number(req.body.venueId ?? req.query.venueId);
    const start = req.body.startDatetime || req.query.startDatetime;
    const end = req.body.endDatetime || req.query.endDatetime;
    if (!clubId || !venueId || !start || !end) return next(badRequest('clubId, venueId, startDatetime and endDatetime are required.'));

    const startValue = toMySqlDateTime(start);
    const endValue = toMySqlDateTime(end);
    const conflictResult = await readPool.execute('CALL sp_check_venue_conflicts(?, ?, ?, NULL)', [venueId, startValue, endValue]);
    const hardConflictRows = extractProcedureRows(conflictResult[0]);
    const softConflictRows = await getSoftScheduleConflicts({ venueId, start: startValue, end: endValue, excludeEventId: null });
    const hardConflicts = normalizeConflictRows(hardConflictRows, clubId);
    const softConflicts = normalizeConflictRows(softConflictRows, clubId).map(conflict => ({ ...conflict, severity: 'soft' }));
    const suggestionsResult = await readPool.execute('CALL sp_free_venues(?, ?, ?)', [startValue, endValue, req.body.minCapacity || req.query.minCapacity || 0]);
    const suggestions = extractProcedureRows(suggestionsResult[0]);
    res.json({
      data: {
        hasConflict: hardConflicts.length > 0 || softConflicts.length > 0,
        hardConflict: hardConflicts.length > 0,
        softConflict: softConflicts.length > 0,
        conflicts: hardConflicts,
        softConflicts,
        suggestions: suggestions.map(row => ({ venueId: row.venue_id, name: row.name, location: row.location, capacity: row.capacity })),
      },
      meta: { rowCount: hardConflicts.length + softConflicts.length, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function listAvailableVenues(req, res, next) {
  try {
    const { start, end, minCapacity } = req.query;
    if (!start || !end) return next(badRequest('start and end are required.'));
    const startValue = toMySqlDateTime(start);
    const endValue = toMySqlDateTime(end);
    const result = await readPool.execute('CALL sp_free_venues(?, ?, ?)', [startValue, endValue, minCapacity ? Number(minCapacity) : 0]);
    const rows = extractProcedureRows(result[0]);
    res.json({ data: rows.map(row => ({ venueId: row.venue_id, name: row.name, location: row.location, capacity: Number(row.capacity) })), meta: { rowCount: rows.length, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function listManageEvents(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const { page, pageSize, offset } = parsePagination(req.query);
    const status = String(req.query.status || 'all');
    const where = ['e.club_id = ?'];
    const params = [clubId];
    if (status !== 'all') {
      where.push('e.status = ?');
      params.push(status);
    }

    const [countRows] = await readPool.execute(`SELECT COUNT(*) AS total FROM events e WHERE ${where.join(' AND ')}`, params);
    const [rows] = await readPool.execute(
      `SELECT e.*, COUNT(r.registration_id) AS registrationCount
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.event_id
       WHERE ${where.join(' AND ')}
       GROUP BY e.event_id
       ORDER BY e.start_datetime DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    res.json(paginated({
      data: rows.map(row => ({
        eventId: Number(row.event_id),
        title: row.title,
        status: row.status,
        startDatetime: row.start_datetime ? new Date(row.start_datetime).toISOString() : null,
        endDatetime: row.end_datetime ? new Date(row.end_datetime).toISOString() : null,
        isTentative: Boolean(row.is_tentative),
        isPlaceholder: Boolean(row.is_placeholder),
        registrationCount: Number(row.registrationCount || 0),
      })),
      total: Number(countRows[0].total),
      page,
      pageSize,
      executionTimeMs: 0,
    }));
  } catch (err) {
    next(err);
  }
}

export async function getEventRegistrations(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const [rows] = await readPool.execute(
      `SELECT r.registration_id AS registrationId, r.student_id AS studentId, u.name, s.roll_no AS rollNo,
              r.status, r.registered_at AS registeredAt,
              a.status AS attendanceStatus,
              cert.certificate_code AS certificateCode
       FROM registrations r
       JOIN students s ON s.student_id = r.student_id
       JOIN users u ON u.user_id = s.student_id
       LEFT JOIN attendance a ON a.registration_id = r.registration_id
       LEFT JOIN certificates cert ON cert.registration_id = r.registration_id
       JOIN events e ON e.event_id = r.event_id
       WHERE e.event_id = ? AND e.club_id = ?
       ORDER BY u.name`,
      [eventId, clubId],
    );

    res.json({
      data: rows.map(row => ({
        registrationId: Number(row.registrationId),
        studentId: Number(row.studentId),
        name: row.name,
        rollNo: row.rollNo,
        status: row.status,
        registeredAt: row.registeredAt ? new Date(row.registeredAt).toISOString() : null,
        attendanceStatus: row.attendanceStatus || null,
        certificateCode: row.certificateCode || null,
      })),
      meta: { rowCount: rows.length, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function markEventAttendance(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const studentId = Number(req.body.studentId);
    const attendanceStatus = String(req.body.status || 'present').toLowerCase();

    if (!studentId) return next(badRequest('studentId is required.'));
    if (!['present', 'absent'].includes(attendanceStatus)) return next(badRequest('status must be present or absent.', 'VALIDATION_ERROR'));

    const [[existingRegistration]] = await readPool.execute(
      'SELECT registration_id FROM registrations WHERE event_id = ? AND student_id = ? AND status = ?',
      [eventId, studentId, 'registered'],
    );
    if (!existingRegistration) return next(notFound('Registration not found.'));

    const [rows] = await writePool.execute(
      `INSERT INTO attendance (registration_id, status, marked_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)`,
      [existingRegistration.registration_id, attendanceStatus, req.user.userId],
    );

    res.status(201).json({
      data: { eventId, studentId, status: attendanceStatus, registrationId: existingRegistration.registration_id, updated: rows.affectedRows > 0 },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function issueEventCertificates(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const studentId = Number(req.body.studentId);
    const certificateType = String(req.body.certificateType || 'participation').toLowerCase();

    if (!studentId) return next(badRequest('studentId is required.'));
    if (!['participation', 'winner', 'runner_up', 'organizer'].includes(certificateType)) return next(badRequest('certificateType is invalid.', 'VALIDATION_ERROR'));

    const [[reg]] = await readPool.execute(
      'SELECT registration_id FROM registrations WHERE event_id = ? AND student_id = ? AND status = ?',
      [eventId, studentId, 'registered'],
    );
    if (!reg) return next(notFound('Registration not found.'));

    const certificateCode = `CERT-${eventId}-${studentId}-${Date.now()}`;
    const [result] = await writePool.execute(
      `INSERT INTO certificates (registration_id, certificate_code, certificate_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE certificate_code = VALUES(certificate_code), certificate_type = VALUES(certificate_type)`,
      [reg.registration_id, certificateCode, certificateType],
    );

    res.status(201).json({
      data: { eventId, studentId, certificateCode, certificateType, skipped: false },
      meta: { rowCount: 1, executionTimeMs: 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClubProfile(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const body = req.body || {};
    const tagline = typeof body.tagline === 'string' ? stripHtml(body.tagline).slice(0, 160) : body.tagline ?? null;
    const description = typeof body.description === 'string' ? stripHtml(body.description).slice(0, 5000) : body.description ?? null;
    const websiteUrl = body.websiteUrl === null || body.websiteUrl === undefined ? null : String(body.websiteUrl).trim();

    if (tagline !== null && tagline.length > 160) return next(badRequest('tagline must be at most 160 characters.', 'VALIDATION_ERROR'));
    if (description !== null && description.length > 5000) return next(badRequest('description must be at most 5000 characters.', 'VALIDATION_ERROR'));
    if (websiteUrl && !/^https?:\/\//.test(websiteUrl)) return next(badRequest('websiteUrl must be http(s).', 'VALIDATION_ERROR'));

    const [rows] = await writePool.execute(
      'UPDATE clubs SET tagline = ?, description = ?, website_url = ?, updated_by = ? WHERE club_id = ?',
      [tagline, description, websiteUrl, req.user.userId, clubId],
    );

    const [[club]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    res.json({ data: club, meta: { rowCount: rows.affectedRows || 0, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function uploadClubLogo(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    if (!req.file) return next(badRequest('logo file is required.'));
    fs.mkdirSync(backendUploadsRoot, { recursive: true });
    const extension = path.extname(req.file.originalname) || '.png';
    const filename = `club-${clubId}-${Date.now()}${extension}`;
    const target = path.join(backendUploadsRoot, filename);
    fs.writeFileSync(target, req.file.buffer);
    const url = `/uploads/${filename}`;
    await writePool.execute('UPDATE clubs SET logo_url = ?, updated_by = ? WHERE club_id = ?', [url, req.user.userId, clubId]);
    res.status(201).json({ data: { clubId, logoUrl: url }, meta: { rowCount: 1, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function createEventPhoto(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const eventId = Number(req.params.eventId);
    const [eventRows] = await readPool.execute('SELECT * FROM events WHERE event_id = ? AND club_id = ?', [eventId, clubId]);
    const event = eventRows[0];
    if (!event) return next(notFound('Event not found.'));
    if (event.status === 'cancelled') {
      return res.status(409).json({ error: { code: 'EVENT_NOT_ELIGIBLE', message: 'Cancelled events cannot have memories uploaded.' } });
    }
    if (!req.files || !req.files.length) return next(badRequest('At least one photo is required.'));
    if (req.files.length > 10) return next(badRequest('You may upload at most 10 files per request.', 'VALIDATION_ERROR'));

    const [countRows] = await readPool.execute('SELECT COUNT(*) AS total FROM event_photos WHERE event_id = ?', [eventId]);
    if (Number(countRows[0].total) + req.files.length > 50) return next(badRequest('This event already has 50 photos.', 'VALIDATION_ERROR'));

    const saved = [];
    const eventPhotosDir = path.join(backendUploadsRoot, 'photos');
    fs.mkdirSync(eventPhotosDir, { recursive: true });
    for (const file of req.files) {
      const filename = `event-${eventId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname) || '.jpg'}`;
      const target = path.join(eventPhotosDir, filename);
      fs.writeFileSync(target, file.buffer);
      const url = `/uploads/photos/${filename}`;
      const captionInput = typeof req.body?.caption === 'string' ? stripHtml(req.body.caption).slice(0, 200).trim() : '';
      const caption = captionInput || file.originalname || null;
      const [insertResult] = await writePool.execute('INSERT INTO event_photos (event_id, image_url, thumbnail_url, caption, display_order, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)', [eventId, url, url, caption, 100, req.user.userId]);
      saved.push({ photoId: insertResult.insertId, imageUrl: url, caption });
    }

    res.status(201).json({ data: saved, meta: { rowCount: saved.length, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function patchEventPhoto(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const photoId = Number(req.params.photoId);
    const body = req.body || {};
    const caption = typeof body.caption === 'string' ? stripHtml(body.caption).slice(0, 200) : body.caption ?? null;
    const displayOrder = Number(body.displayOrder ?? 100);

    if (caption !== null && caption.length > 200) return next(badRequest('caption must be at most 200 characters.', 'VALIDATION_ERROR'));
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 1000) {
      return next(badRequest('displayOrder must be between 1 and 1000.', 'VALIDATION_ERROR'));
    }

    const [photoRows] = await readPool.execute(
      `SELECT ep.photo_id, e.club_id FROM event_photos ep JOIN events e ON e.event_id = ep.event_id WHERE ep.photo_id = ?`,
      [photoId],
    );
    if (!photoRows.length) return next(notFound('Photo not found.'));
    if (Number(photoRows[0].club_id) !== clubId) return next(notFound('Photo does not belong to this club.'));

    await writePool.execute('UPDATE event_photos SET caption = ?, display_order = ? WHERE photo_id = ?', [caption, displayOrder, photoId]);
    const [[photo]] = await readPool.execute('SELECT * FROM event_photos WHERE photo_id = ?', [photoId]);
    res.json({ data: photo, meta: { rowCount: 1, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}

export async function deleteEventPhoto(req, res, next) {
  try {
    const clubId = Number(req.params.clubId);
    const photoId = Number(req.params.photoId);
    const [photoRows] = await readPool.execute(
      `SELECT ep.photo_id, ep.image_url, e.club_id FROM event_photos ep JOIN events e ON e.event_id = ep.event_id WHERE ep.photo_id = ?`,
      [photoId],
    );
    if (!photoRows.length) return next(notFound('Photo not found.'));
    if (Number(photoRows[0].club_id) !== clubId) return next(notFound('Photo does not belong to this club.'));

    const filePath = path.join(backendUploadsRoot, 'photos', path.basename(photoRows[0].image_url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await writePool.execute('DELETE FROM event_photos WHERE photo_id = ?', [photoId]);
    res.json({ data: { photoId, deleted: true }, meta: { rowCount: 1, executionTimeMs: 0 } });
  } catch (err) {
    next(err);
  }
}
