// src/controllers/publicClubsController.js
// Public, read-only endpoints for clubs, events and certificate verification.
// No authentication required.  Uses readPool only.  Never returns emails,
// phone numbers, password hashes or roll numbers.

import { readPool } from '../config/db.js';
import { timed }    from '../middleware/timing.js';
import { notFound } from '../middleware/errorHandler.js';
import { parsePagination, paginated } from '../utils/pagination.js';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

/** Prefix relative paths (starting with '/') with PUBLIC_BASE_URL. */
function resolveUrl(value) {
  if (!value) return null;
  return value.startsWith('/') ? `${PUBLIC_BASE_URL}${value}` : value;
}

/** Escape MySQL LIKE wildcards in user-supplied search terms. */
function escapeLike(str) {
  return str.replace(/[%_\\]/g, c => `\\${c}`);
}

const CACHE = 'public, max-age=60';

// ── 1. GET /api/clubs ────────────────────────────────────────────────────────
// Active clubs only. Filters: category (id or name), search (name/tagline).
export async function listPublicClubs(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { category, search } = req.query;

    const where  = ['c.status = ?'];
    const params = ['active'];

    // category filter: numeric id OR category name
    if (category !== undefined && category !== '') {
      const catNum = Number(category);
      if (!Number.isNaN(catNum) && Number.isInteger(catNum) && catNum > 0) {
        where.push('c.category_id = ?');
        params.push(catNum);
      } else {
        where.push('cc.name LIKE ?');
        params.push(`%${escapeLike(String(category))}%`);
      }
    }

    // search filter: name or tagline
    if (search !== undefined && search !== '') {
      const escaped = escapeLike(String(search));
      where.push('(c.name LIKE ? OR c.tagline LIKE ?)');
      params.push(`%${escaped}%`, `%${escaped}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute(
        `SELECT COUNT(*) AS total
         FROM clubs c
         JOIN club_categories cc ON cc.category_id = c.category_id
         ${whereClause}`,
        params,
      );

      const [rows] = await readPool.execute(
        `SELECT
           c.club_id      AS clubId,
           c.name,
           c.tagline,
           c.logo_url     AS logoUrl,
           cc.name        AS category,
           COUNT(CASE WHEN cm.status = 'approved' THEN 1 END) AS memberCount
         FROM clubs c
         JOIN club_categories cc ON cc.category_id = c.category_id
         LEFT JOIN club_members cm ON cm.club_id = c.club_id
         ${whereClause}
         GROUP BY c.club_id, c.name, c.tagline, c.logo_url, cc.name
         ORDER BY c.name
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );

      return { rows, total };
    });

    const data = result.rows.map(r => ({ ...r, logoUrl: resolveUrl(r.logoUrl) }));

    res.set('Cache-Control', CACHE);
    res.json(paginated({ data, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

// ── 2. GET /api/clubs/:clubId ────────────────────────────────────────────────
// Full club profile: details + core members + upcoming events.
export async function getPublicClub(req, res, next) {
  try {
    const clubId = parseInt(req.params.clubId, 10);

    const { result, executionTimeMs } = await timed(async () => {
      // Club row
      const [[club]] = await readPool.execute(
        `SELECT
           c.club_id           AS clubId,
           c.name,
           c.tagline,
           c.description,
           c.logo_url          AS logoUrl,
           c.website_url       AS websiteUrl,
           c.source_url        AS sourceUrl,
           c.contact_email     AS contactEmail,
           cc.name             AS category,
           fa.name             AS facultyAdvisor
         FROM clubs c
         JOIN club_categories cc ON cc.category_id      = c.category_id
         LEFT JOIN users       fa ON fa.user_id          = c.faculty_advisor_id
         WHERE c.club_id = ? AND c.status = 'active'`,
        [clubId],
      );
      if (!club) return null;

      // Core members from v_club_core_members
      const [coreMembers] = await readPool.execute(
        `SELECT
           v.student_id        AS studentId,
           v.name,
           v.profile_photo_url AS photoUrl,
           v.member_role       AS role,
           v.position_title    AS positionTitle
         FROM v_club_core_members v
         WHERE v.club_id = ?
         ORDER BY v.display_order, v.name`,
        [clubId],
      );

      const [links] = await readPool.execute(
        `SELECT platform, url
         FROM club_links
         WHERE club_id = ?
         ORDER BY platform, url`,
        [clubId],
      );

      const [contacts] = await readPool.execute(
        `SELECT person_name AS name, designation, is_faculty AS isFaculty
         FROM club_contacts
         WHERE club_id = ?
         ORDER BY display_order, contact_id`,
        [clubId],
      );

      // Upcoming events (next 12 months, default from view)
      const [upcoming] = await readPool.execute(
        `SELECT
           v.event_id              AS eventId,
           v.title,
           v.event_type            AS eventType,
           v.start_datetime        AS startDatetime,
           v.end_datetime          AS endDatetime,
           v.is_tentative          AS isTentative,
           v.is_placeholder        AS isPlaceholder,
           v.poster_url            AS posterUrl,
           v.venue,
           v.signup_mode           AS signupMode,
           v.external_signup_url   AS externalSignupUrl,
           v.registration_deadline AS registrationDeadline
         FROM v_upcoming_events v
         WHERE v.club_id = ?
         ORDER BY v.start_datetime`,
        [clubId],
      );

      return { club, coreMembers, links, contacts, upcoming };
    });

    if (!result) return next(notFound('Club not found.', 'CLUB_NOT_FOUND'));

    const { club, coreMembers, links, contacts, upcoming } = result;

    const mapEvent = e => ({
      eventId             : e.eventId,
      title               : e.title,
      eventType           : e.eventType,
      startDatetime       : e.startDatetime       ? new Date(e.startDatetime).toISOString()       : null,
      endDatetime         : e.endDatetime          ? new Date(e.endDatetime).toISOString()          : null,
      isTentative         : Boolean(e.isTentative),
      isPlaceholder       : Boolean(e.isPlaceholder),
      posterUrl           : resolveUrl(e.posterUrl),
      venue               : e.venue,
      signupMode          : e.signupMode,
      externalSignupUrl   : e.signupMode === 'external' ? e.externalSignupUrl : null,
      registrationDeadline: e.registrationDeadline ? new Date(e.registrationDeadline).toISOString() : null,
    });

    res.set('Cache-Control', CACHE);
    res.json({
      data: {
        ...club,
        logoUrl       : resolveUrl(club.logoUrl),
        websiteUrl    : resolveUrl(club.websiteUrl),
        sourceUrl     : resolveUrl(club.sourceUrl),
        coreMembers   : coreMembers.map(m => ({ ...m, photoUrl: resolveUrl(m.photoUrl) })),
        links         : links.map(link => ({ ...link, url: resolveUrl(link.url) })),
        contacts      : contacts.map(contact => ({ ...contact, isFaculty: Boolean(contact.isFaculty) })),
        upcomingEvents: upcoming.map(mapEvent),
      },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

// ── 3. GET /api/clubs/:clubId/events/upcoming ────────────────────────────────
// Upcoming events for a club. ?months defaults to 12, clamped to 1..24.
export async function getUpcomingEvents(req, res, next) {
  try {
    const clubId = parseInt(req.params.clubId, 10);
    const months = Math.min(24, Math.max(1, parseInt(req.query.months || '12', 10) || 12));

    const { result, executionTimeMs } = await timed(async () => {
      // Verify club exists and is active
      const [[club]] = await readPool.execute(
        'SELECT club_id FROM clubs WHERE club_id = ? AND status = ?',
        [clubId, 'active'],
      );
      if (!club) return null;

      const [rows] = await readPool.execute(
        `SELECT
           v.event_id              AS eventId,
           v.title,
           v.event_type            AS eventType,
           v.start_datetime        AS startDatetime,
           v.end_datetime          AS endDatetime,
           v.is_tentative          AS isTentative,
           v.is_placeholder        AS isPlaceholder,
           v.poster_url            AS posterUrl,
           v.venue,
           v.signup_mode           AS signupMode,
           v.external_signup_url   AS externalSignupUrl,
           v.registration_deadline AS registrationDeadline
         FROM v_upcoming_events v
         WHERE v.club_id = ?
           AND v.start_datetime < DATE_ADD(NOW(), INTERVAL ? MONTH)
         ORDER BY v.start_datetime`,
        [clubId, months],
      );
      return rows;
    });

    if (!result) return next(notFound('Club not found.', 'CLUB_NOT_FOUND'));

    const data = result.map(e => ({
      eventId             : e.eventId,
      title               : e.title,
      eventType           : e.eventType,
      startDatetime       : e.startDatetime       ? new Date(e.startDatetime).toISOString()       : null,
      endDatetime         : e.endDatetime          ? new Date(e.endDatetime).toISOString()          : null,
      isTentative         : Boolean(e.isTentative),
      isPlaceholder       : Boolean(e.isPlaceholder),
      posterUrl           : resolveUrl(e.posterUrl),
      venue               : e.venue,
      signupMode          : e.signupMode,
      externalSignupUrl   : e.signupMode === 'external' ? e.externalSignupUrl : null,
      registrationDeadline: e.registrationDeadline ? new Date(e.registrationDeadline).toISOString() : null,
    }));

    res.set('Cache-Control', CACHE);
    res.json({ data, meta: { rowCount: data.length, executionTimeMs } });
  } catch (err) {
    next(err);
  }
}

// ── 4. GET /api/clubs/:clubId/events/past ────────────────────────────────────
// Past events, paginated, newest first. Excludes cancelled events.
export async function getPastEvents(req, res, next) {
  try {
    const clubId = parseInt(req.params.clubId, 10);
    const { page, pageSize, offset } = parsePagination(req.query);

    const { result, executionTimeMs } = await timed(async () => {
      // Verify club exists and is active
      const [[club]] = await readPool.execute(
        'SELECT club_id FROM clubs WHERE club_id = ? AND status = ?',
        [clubId, 'active'],
      );
      if (!club) return null;

      // v_past_events includes completed + any event where end_datetime < NOW().
      // Explicitly exclude cancelled events via join to events table.
      const [[{ total }]] = await readPool.execute(
        `SELECT COUNT(*) AS total
         FROM v_past_events v
         JOIN events e ON e.event_id = v.event_id
         WHERE v.club_id = ? AND e.status <> 'cancelled'`,
        [clubId],
      );

      const [rows] = await readPool.execute(
        `SELECT
           v.event_id       AS eventId,
           v.title,
           v.event_type     AS eventType,
           v.start_datetime AS startDatetime,
           v.is_placeholder AS isPlaceholder,
           v.poster_url     AS posterUrl,
           v.recap_text     AS recapText,
           v.photo_count    AS photoCount
         FROM v_past_events v
         JOIN events e ON e.event_id = v.event_id
         WHERE v.club_id = ? AND e.status <> 'cancelled'
         ORDER BY v.start_datetime DESC
         LIMIT ? OFFSET ?`,
        [clubId, pageSize, offset],
      );
      return { rows, total };
    });

    if (!result) return next(notFound('Club not found.', 'CLUB_NOT_FOUND'));

    const data = result.rows.map(e => ({
      ...e,
      startDatetime: e.startDatetime ? new Date(e.startDatetime).toISOString() : null,
      isPlaceholder: Boolean(e.isPlaceholder),
      posterUrl    : resolveUrl(e.posterUrl),
    }));

    res.set('Cache-Control', CACHE);
    res.json(paginated({ data, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

// ── 5. GET /api/events/:eventId/memories ────────────────────────────────────
// Memory page: event details + photos. Only completed/past non-cancelled events.
export async function getEventMemories(req, res, next) {
  try {
    const eventId = parseInt(req.params.eventId, 10);

    const { result, executionTimeMs } = await timed(async () => {
      const [[event]] = await readPool.execute(
        `SELECT
           e.event_id       AS eventId,
           e.title,
           e.start_datetime AS startDatetime,
           e.end_datetime   AS endDatetime,
           e.is_placeholder AS isPlaceholder,
           e.recap_text     AS recapText,
           e.status,
           c.club_id        AS clubId,
           c.name           AS clubName
         FROM events e
         JOIN clubs c ON c.club_id = e.club_id
         WHERE e.event_id = ?`,
        [eventId],
      );
      if (!event) return null;

      // Only completed events or events whose end time is in the past; never cancelled.
      const isPast = event.status === 'completed'
        || (event.endDatetime && new Date(event.endDatetime) < new Date());
      if (!isPast || event.status === 'cancelled') return { notAllowed: true };

      const [photos] = await readPool.execute(
        `SELECT
           photo_id      AS photoId,
           image_url     AS imageUrl,
           thumbnail_url AS thumbnailUrl,
           caption
         FROM event_photos
         WHERE event_id = ?
         ORDER BY display_order`,
        [eventId],
      );

      return { event, photos };
    });

    if (!result)             return next(notFound('Event not found.',               'NOT_FOUND'));
    if (result.notAllowed)   return next(notFound('Event memories not available.',  'NOT_FOUND'));

    const { event, photos } = result;

    res.set('Cache-Control', CACHE);
    res.json({
      data: {
        event: {
          eventId      : event.eventId,
          title        : event.title,
          startDatetime: event.startDatetime ? new Date(event.startDatetime).toISOString() : null,
          isPlaceholder: Boolean(event.isPlaceholder),
          recapText    : event.recapText,
          club         : { clubId: event.clubId, name: event.clubName },
        },
        photos: photos.map(p => ({
          photoId     : p.photoId,
          imageUrl    : resolveUrl(p.imageUrl),
          thumbnailUrl: resolveUrl(p.thumbnailUrl),
          caption     : p.caption,
        })),
      },
      meta: { rowCount: photos.length, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

// ── 6. GET /api/events/:eventId ──────────────────────────────────────────────
// Public event detail. 404 for cancelled. Must be mounted AFTER static routes.
export async function getPublicEvent(req, res, next) {
  try {
    const eventId = parseInt(req.params.eventId, 10);

    const { result, executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT
           e.event_id              AS eventId,
           e.title,
           e.description,
           e.event_type            AS eventType,
           e.start_datetime        AS startDatetime,
           e.end_datetime          AS endDatetime,
           e.is_tentative          AS isTentative,
           e.is_placeholder        AS isPlaceholder,
           e.poster_url            AS posterUrl,
           e.signup_mode           AS signupMode,
           e.external_signup_url   AS externalSignupUrl,
           e.registration_deadline AS registrationDeadline,
           e.status,
           v.name                  AS venue,
           c.club_id               AS clubId,
           c.name                  AS clubName
         FROM events e
         JOIN venues v ON v.venue_id = e.venue_id
         JOIN clubs  c ON c.club_id  = e.club_id
         WHERE e.event_id = ?`,
        [eventId],
      ),
    );

    const [[event]] = result;
    if (!event || event.status === 'cancelled') {
      return next(notFound('Event not found.', 'NOT_FOUND'));
    }

    res.set('Cache-Control', CACHE);
    res.json({
      data: {
        eventId             : event.eventId,
        title               : event.title,
        description         : event.description,
        eventType           : event.eventType,
        startDatetime       : event.startDatetime       ? new Date(event.startDatetime).toISOString()       : null,
        endDatetime         : event.endDatetime          ? new Date(event.endDatetime).toISOString()          : null,
        isTentative         : Boolean(event.isTentative),
        isPlaceholder       : Boolean(event.isPlaceholder),
        posterUrl           : resolveUrl(event.posterUrl),
        venue               : event.venue,
        signupMode          : event.signupMode,
        externalSignupUrl   : event.signupMode === 'external' ? event.externalSignupUrl : null,
        registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline).toISOString() : null,
        club                : { clubId: event.clubId, name: event.clubName },
      },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

// ── 7. GET /certificates/verify/:code ───────────────────────────────────────
// Certificate verification. Returns public fields only; NO email/roll/phone.
export async function verifyCertificate(req, res, next) {
  try {
    const { code } = req.params;

    const { result, executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT
           cert.certificate_code AS certificateCode,
           cert.certificate_type AS type,
           cert.issued_at        AS issuedAt,
           u.name                AS studentName,
           e.title               AS eventTitle,
           c.name                AS club
         FROM certificates cert
         JOIN registrations r ON r.registration_id = cert.registration_id
         JOIN students      s ON s.student_id       = r.student_id
         JOIN users         u ON u.user_id           = s.student_id
         JOIN events        e ON e.event_id          = r.event_id
         JOIN clubs         c ON c.club_id           = e.club_id
         WHERE cert.certificate_code = ?`,
        [code],
      ),
    );

    const [[cert]] = result;
    if (!cert) {
      return next(notFound('Certificate not found.', 'CERTIFICATE_NOT_FOUND'));
    }

    res.json({
      data: {
        valid      : true,
        studentName: cert.studentName,
        eventTitle : cert.eventTitle,
        club       : cert.club,
        type       : cert.type,
        issuedAt   : cert.issuedAt ? new Date(cert.issuedAt).toISOString() : null,
      },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}
