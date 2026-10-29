// src/routes/events.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireClubRank, requireEntityClubRank } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listEvents, createEvent, filterEvents, updateEvent,
  registerForEvent, cancelRegistration,
  markAttendance, issueCertificate,
} from '../controllers/eventsController.js';

const router = Router();

// Shared datetime string check
const dt = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/));

const eventBase = z.object({
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
  external_signup_url  : z.string().url().max(255).optional().nullable(),
  registration_deadline: dt.optional().nullable(),
  max_participants     : z.number().int().positive().optional().nullable(),
  recap_text           : z.string().optional().nullable(),
  status               : z.enum(['scheduled','ongoing','completed','cancelled']).optional(),
});

function checkEventRules(data, ctx) {
  // 1. end_datetime > start_datetime
  if (data.start_datetime && data.end_datetime) {
    if (new Date(data.end_datetime) <= new Date(data.start_datetime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_datetime must be after start_datetime',
        path: ['end_datetime'],
      });
    }
  }

  // 2. registration_deadline <= start_datetime
  if (data.registration_deadline && data.start_datetime) {
    if (new Date(data.registration_deadline) > new Date(data.start_datetime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'registration_deadline must be on or before start_datetime',
        path: ['registration_deadline'],
      });
    }
  }

  // 3. external sign-up requires external_signup_url
  if (data.signup_mode === 'external' && !data.external_signup_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'external_signup_url is required when signup_mode is external',
      path: ['external_signup_url'],
    });
  }

  // 4. internal sign-up requires max_participants
  if (data.signup_mode === 'internal' && (data.max_participants === undefined || data.max_participants === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'max_participants is required when signup_mode is internal',
      path: ['max_participants'],
    });
  }

  // 5. URLs must start with http:// or https://
  if (data.external_signup_url) {
    const u = data.external_signup_url;
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'external_signup_url must start with http:// or https://',
        path: ['external_signup_url'],
      });
    }
  }

  if (data.poster_url) {
    const u = data.poster_url;
    if (u.includes('://') && !u.startsWith('http://') && !u.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'poster_url must start with http:// or https://',
        path: ['poster_url'],
      });
    }
  }
}

const createEventSchema = eventBase.superRefine(checkEventRules);
const updateEventSchema = eventBase.omit({ club_id: true }).partial().superRefine(checkEventRules);

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
// Q2: Club core members (rank >= 2) or admin can create events for club_id in body
router.post('/',        requireAuth, requireClubRank(2, req => req.body.club_id), validate(createEventSchema), createEvent);
// Q8: Loads event from DB, takes club_id from DB row, never trusts body
router.put('/:id',      requireAuth, requireEntityClubRank('event', 2), validate(updateEventSchema), updateEvent);

// Business endpoints
router.post('/:id/register',     requireAuth, registerForEvent);
router.delete('/:id/register',   requireAuth, cancelRegistration);
router.post('/:id/attendance',   requireAuth, requireEntityClubRank('event', 2), validate(attendanceSchema), markAttendance);
router.post('/:id/certificates', requireAuth, requireEntityClubRank('event', 2), validate(certSchema), issueCertificate);

export default router;
