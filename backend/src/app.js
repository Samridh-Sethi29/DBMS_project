// src/app.js
// Application entry point. Composes middleware, mounts routes, starts server.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { timing, timed } from './middleware/timing.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes       from './routes/auth.js';
import eventsRoutes     from './routes/events.js';
import studentsRoutes   from './routes/students.js';
import clubsRoutes      from './routes/clubs.js';
import publicClubsRoutes  from './routes/publicClubs.js';
import { eventsPublicRouter, certificatesRouter } from './routes/publicEvents.js';
import venuesRoutes     from './routes/venues.js';
import queryRoutes      from './routes/query.js';
import { readPool }     from './config/db.js';

const app  = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const backendDir = path.dirname(fileURLToPath(import.meta.url));

// ── Global middleware ────────────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(timing);  // attach req.startHr for per-request timing
const uploadsDir = path.resolve(backendDir, '../uploads');
if (existsSync(uploadsDir)) app.use('/uploads', express.static(uploadsDir));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } },
});

// Request logger (dev-only; replace with a proper logger in production)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ── General Lookups ──────────────────────────────────────────────────────
app.get('/api/departments', async (_req, res, next) => {
  try {
    const { result: [rows], executionTimeMs } = await timed(() =>
      readPool.execute('SELECT department_id, name FROM departments ORDER BY name')
    );
    res.json({ data: rows, meta: { rowCount: rows.length, executionTimeMs } });
  } catch (err) {
    next(err);
  }
});

app.get('/api/categories', async (_req, res, next) => {
  try {
    const { result: [rows], executionTimeMs } = await timed(() =>
      readPool.execute('SELECT category_id, name FROM club_categories ORDER BY name')
    );
    res.json({ data: rows, meta: { rowCount: rows.length, executionTimeMs } });
  } catch (err) {
    next(err);
  }
});

// ── Routes ───────────────────────────────────────────────────────────────
app.use('/auth/login', authRateLimit);
app.use('/auth/register', authRateLimit);
app.use('/auth',         authRoutes);
// Public event routes (memories + single event detail) must be registered BEFORE
// the authenticated eventsRoutes so :eventId digits don't swallow /all or /filter.
app.use('/api/events',   eventsPublicRouter);
app.use('/api/events',   eventsRoutes);
app.use('/api/students', studentsRoutes);
// Public clubs (GET / and GET /:clubId) registered BEFORE the auth-gated router
// so they replace those two handlers; the auth-gated router still owns POST/PUT/DELETE.
app.use('/api/clubs',    publicClubsRoutes);
app.use('/api/clubs',    clubsRoutes);
app.use('/api/venues',   venuesRoutes);
app.use('/api',          queryRoutes);   // aggregate, join, subquery, correlated, dashboard, reports
// Certificate verification (public, no auth)
app.use('/certificates', certificatesRouter);

// ── Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── 404 handler ──────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({
  error: { code: 'NOT_FOUND', message: 'Route not found.' },
}));

// ── Central error handler ────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Club & Event API running on http://localhost:${PORT}`);
  console.log(`    Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`    DB          : ${process.env.DB_HOST}/${process.env.DB_NAME}\n`);
});

export default app;
