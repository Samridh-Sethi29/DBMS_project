// src/app.js
// Application entry point. Composes middleware, mounts routes, starts server.

import 'dotenv/config';
import express from 'express';
import { timing } from './middleware/timing.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes    from './routes/auth.js';
import eventsRoutes  from './routes/events.js';
import studentsRoutes from './routes/students.js';
import clubsRoutes   from './routes/clubs.js';
import venuesRoutes  from './routes/venues.js';
import queryRoutes   from './routes/query.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(timing);  // attach req.startHr for per-request timing

// Request logger (dev-only; replace with a proper logger in production)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ── Routes ───────────────────────────────────────────────────────────────
app.use('/auth',         authRoutes);
app.use('/api/events',   eventsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/clubs',    clubsRoutes);
app.use('/api/venues',   venuesRoutes);
app.use('/api',          queryRoutes);   // aggregate, join, subquery, correlated, dashboard, reports

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
