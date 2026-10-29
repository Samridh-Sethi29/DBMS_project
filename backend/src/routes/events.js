// src/routes/events.js
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listEvents, createEvent, filterEvents, updateEvent,
  registerForEvent, cancelRegistration,
  markAttendance, issueCertificate,
} from '../controllers/eventsController.js';

const router = Router();

// Shared datetime string check
const dt = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/));

const createEventSchema = z.object({
  club_id              : z.number().int().positive(),
  venue_id             : z.number().int().positive(),
  title                : z.string().min(3).max(200),
  description          : z.string().optional(),
  event_type           : z.enum(['technical','cultural','academic','sports','workshop','other']),
  start_datetime       : dt,
  end_datetime         : dt,
  registration_deadline: dt,
  max_participants     : z.number().int().positive(),
});

const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(['scheduled','ongoing','completed','cancelled']).optional(),
});

const attendanceSchema = z.object({
  student_id: z.number().int().positive(),
  status    : z.enum(['present','absent']).optional(),
});

const certSchema = z.object({
  student_id       : z.number().int().positive(),
  certificate_type : z.string().min(2).max(100).optional(),
});

// ── Routes ──────────────────────────────────────────────────────────────
// Q1
router.get('/',         listEvents);
// Q4
router.get('/filter',   filterEvents);
// Q2
router.post('/',        requireAuth, requireRole('admin','coordinator'), validate(createEventSchema), createEvent);
// Q8
router.put('/:id',      requireAuth, requireRole('admin','coordinator'), validate(updateEventSchema), updateEvent);

// Business endpoints
router.post('/:id/register',     requireAuth, requireRole('student'), registerForEvent);
router.delete('/:id/register',   requireAuth, requireRole('student'), cancelRegistration);
router.post('/:id/attendance',   requireAuth, requireRole('admin','coordinator'), validate(attendanceSchema), markAttendance);
router.post('/:id/certificates', requireAuth, requireRole('admin','coordinator'), validate(certSchema), issueCertificate);

export default router;
