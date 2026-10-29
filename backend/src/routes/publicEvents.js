// src/routes/publicEvents.js
// Public (no-auth) routes for event detail, event memories,
// and certificate verification.
//
// IMPORTANT: this module is mounted BEFORE the authenticated events router
// in app.js so that /:eventId (digit-restricted) does not shadow /all or /filter.

import { Router } from 'express';
import {
  getEventMemories,
  getPublicEvent,
  verifyCertificate,
} from '../controllers/publicClubsController.js';

// ── Positive-integer param guard ─────────────────────────────────────────────
function posIntParam(name) {
  return (req, res, next) => {
    const raw = req.params[name];
    const v   = parseInt(raw, 10);
    if (!Number.isFinite(v) || v <= 0 || String(v) !== raw) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `${name} must be a positive integer.` },
      });
    }
    next();
  };
}

// ── /api/events/* public routes ──────────────────────────────────────────────
// Restrict :eventId to digits so it never shadows /all, /filter, etc.
export const eventsPublicRouter = Router();

// 5. GET /api/events/:eventId/memories
eventsPublicRouter.get('/:eventId(\\d+)/memories',
  posIntParam('eventId'),
  getEventMemories,
);

// 6. GET /api/events/:eventId  — must be last so /all and /filter still work
eventsPublicRouter.get('/:eventId(\\d+)',
  posIntParam('eventId'),
  getPublicEvent,
);

// ── /certificates/* routes ───────────────────────────────────────────────────
// 7. GET /certificates/verify/:code
export const certificatesRouter = Router();

certificatesRouter.get('/verify/:code', verifyCertificate);
