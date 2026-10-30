// src/routes/publicClubs.js
// Public (no-auth) routes for clubs, events and certificate verification.
// Validates :clubId / :eventId as positive integers (400 on failure).
// Mounted in app.js before the authenticated clubs/events routers.

import { Router } from 'express';
import { z }      from 'zod';
import { zodErrors } from '../utils/zodErrors.js';
import {
  listPublicClubs,
  getPublicClub,
  getUpcomingEvents,
  getPastEvents,
  getEventMemories,
  getPublicEvent,
  verifyCertificate,
} from '../controllers/publicClubsController.js';

const router = Router();

// Zod helper: positive integer param (rejects "abc", "0", negative)
function posIntParam(name) {
  return (req, res, next) => {
    const v = parseInt(req.params[name], 10);
    if (!Number.isFinite(v) || v <= 0 || String(v) !== req.params[name]) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${name} must be a positive integer.`,
          fields: zodErrors([{ path: [name], message: `${name} must be a positive integer.` }]),
        },
      });
    }
    next();
  };
}

// Query-param validators for list endpoints
const listClubsQuerySchema = z.object({
  category: z.string().optional(),
  search  : z.string().optional(),
  page    : z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const upcomingQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).optional(),
});

const pastQuerySchema = z.object({
  page    : z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code   : 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          fields : zodErrors(parsed.error.issues),
        },
      });
    }
    next();
  };
}

// ── Club routes ─────────────────────────────────────────────────────────────

// 1. GET /api/clubs  (replaces the existing listClubs handler in clubs.js)
router.get('/',
  validateQuery(listClubsQuerySchema),
  listPublicClubs,
);

// 2. GET /api/clubs/:clubId  (replaces the existing getClub handler in clubs.js)
router.get('/:clubId',
  posIntParam('clubId'),
  getPublicClub,
);

// 3. GET /api/clubs/:clubId/events/upcoming
router.get('/:clubId/events/upcoming',
  posIntParam('clubId'),
  validateQuery(upcomingQuerySchema),
  getUpcomingEvents,
);

// 4. GET /api/clubs/:clubId/events/past
router.get('/:clubId/events/past',
  posIntParam('clubId'),
  validateQuery(pastQuerySchema),
  getPastEvents,
);

export default router;
