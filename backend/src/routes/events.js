// src/routes/events.js
import { Router } from 'express';
import { z } from 'zod';
import { readPool } from '../config/db.js';
import { requireAuth, requireClubRank } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listEvents, createEvent, filterEvents, updateEvent,
  registerForEvent, cancelRegistration,
  markAttendance, issueCertificate,
} from '../controllers/eventsController.js';

const router = Router();

// Shared datetime string check
const dt = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/));

const httpUrl = z.string().url().refine(
  u => u.startsWith('http://') || u.startsWith('https://'),
  { message: 'URL must start with http:// or https://' },
);

async function getEventClubId(req) {
  const eventId = parseInt(req.params.id, 10);
  if (!eventId) return null;
  const [[e]] = await readPool.execute('SELECT club_id FROM events WHERE event_id = ?', [eventId]);
  return e?.club_id || null;
}

const createEventSchema = z.object({
  club_id              : z.number().int().positive(),
  venue_id             : z.number().int().positive(),
  title                : z.string().min(3).max(150),
  description          : z.string().optional().nullable(),
  event_type           : z.enum(['technical','cultural','academic','sports','workshop','other']),
  start_datetime       : dt,
  end_datetime         : dt,
  is_tentative         : z.boolean().optional().default(false),
  poster_url           : z.string().max(255).optional().nullable(),
  signup_mode          : z.enum(['none','internal','external']).optional().default('none'),
  external_signup_url  : httpUrl.optional().nullable(),
  registration_deadline: dt.optional().nullable(),
  max_participants     : z.number().int().positive().optional().nullable(),
}).refine(
  data => data.signup_mode !== 'external' || !!data.external_signup_url,
  { message: 'external_signup_url is required when signup_mode is external', path: ['external_signup_url'] }
).refine(
  data => data.signup_mode !== 'internal' || (data.max_participants !== undefined && data.max_participants !== null),
  { message: 'max_participants is required when signup_mode is internal', path: ['max_participants'] }
);

const updateEventSchema = createEventSchema.partial().extend({
  recap_text: z.string().optional().nullable(),
  status    : z.enum(['scheduled','ongoing','completed','cancelled']).optional(),
});

const attendanceSchema = z.object({
  student_id: z.number().int().positive(),
  status    : z.enum(['present','absent']).optional().default('present'),
});

const certSchema = z.object({
  student_id       : z.number().int().positive(),
  certificate_type : z.enum(['participation','winner','runner_up','organizer']).optional().default('participation'),
});

// ── Routes ──────────────────────────────────────────────────────────────
// Q1
router.get('/',         listEvents);
// Q4
router.get('/filter',   filterEvents);
// Q2: Club core members (rank >= 2) or admin can create events
router.post('/',        requireAuth, requireClubRank(2, req => req.body.club_id), validate(createEventSchema), createEvent);
// Q8: Club core members (rank >= 2) or admin can update events
router.put('/:id',      requireAuth, requireClubRank(2, getEventClubId), validate(updateEventSchema), updateEvent);

// Business endpoints
router.post('/:id/register',     requireAuth, registerForEvent);
router.delete('/:id/register',   requireAuth, cancelRegistration);
router.post('/:id/attendance',   requireAuth, requireClubRank(2, getEventClubId), validate(attendanceSchema), markAttendance);
router.post('/:id/certificates', requireAuth, requireClubRank(2, getEventClubId), validate(certSchema), issueCertificate);

export default router;
