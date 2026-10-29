// src/controllers/dashboardController.js
// GET /api/dashboard
// Returns key stats for every table using a single UNION ALL query + Promise.all
// for the few stats that need separate logic. Every stat comes with a message string.

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';

export async function dashboard(req, res, next) {
  try {
    const { result, executionTimeMs } = await timed(async () => {
      // ── Single UNION ALL query for row-count stats ──────────────────────
      const [statRows] = await readPool.execute(`
        SELECT 'total_users'        AS stat, COUNT(*) AS value FROM users WHERE is_active = 1
        UNION ALL
        SELECT 'total_students'     AS stat, COUNT(*) AS value FROM students
        UNION ALL
        SELECT 'total_clubs'        AS stat, COUNT(*) AS value FROM clubs WHERE status = 'active'
        UNION ALL
        SELECT 'total_events'       AS stat, COUNT(*) AS value FROM events
        UNION ALL
        SELECT 'upcoming_events'    AS stat, COUNT(*) AS value FROM events WHERE status = 'scheduled' AND start_datetime > NOW()
        UNION ALL
        SELECT 'total_venues'       AS stat, COUNT(*) AS value FROM venues
        UNION ALL
        SELECT 'total_registrations'AS stat, COUNT(*) AS value FROM registrations WHERE status = 'registered'
        UNION ALL
        SELECT 'total_attendance'   AS stat, COUNT(*) AS value FROM attendance WHERE status = 'present'
        UNION ALL
        SELECT 'certificates_issued'AS stat, COUNT(*) AS value FROM certificates
        UNION ALL
        SELECT 'audit_today'        AS stat, COUNT(*) AS value FROM application_audit_log WHERE DATE(changed_at) = CURDATE()
      `);

      // ── Separate queries for derived/ratio stats ────────────────────────
      const [[fillRateRow]] = await readPool.execute(`
        SELECT ROUND(
          SUM(CASE WHEN r.status = 'registered' THEN 1 ELSE 0 END) /
          NULLIF(SUM(e.max_participants), 0) * 100, 2
        ) AS fill_rate_pct
        FROM events e
        LEFT JOIN registrations r ON r.event_id = e.event_id
        WHERE e.status IN ('scheduled','ongoing')
      `);

      const [[attendanceRow]] = await readPool.execute(`
        SELECT ROUND(
          SUM(a.status = 'present') / NULLIF(COUNT(*), 0) * 100, 2
        ) AS attendance_pct
        FROM attendance a
      `);

      // Build stats map
      const stats = {};
      for (const row of statRows) stats[row.stat] = row.value;

      return {
        ...stats,
        fill_rate_pct    : fillRateRow.fill_rate_pct    ?? 0,
        attendance_pct   : attendanceRow.attendance_pct ?? 0,
      };
    });

    const msgs = {
      total_users        : `${result.total_users} active users in the system.`,
      total_students     : `${result.total_students} students registered.`,
      total_clubs        : `${result.total_clubs} active clubs running.`,
      total_events       : `${result.total_events} events created in total.`,
      upcoming_events    : `${result.upcoming_events} events scheduled in the future.`,
      total_venues       : `${result.total_venues} venues available.`,
      total_registrations: `${result.total_registrations} active event registrations.`,
      total_attendance   : `${result.total_attendance} attendance records marked present.`,
      certificates_issued: `${result.certificates_issued} certificates issued to date.`,
      audit_today        : `${result.audit_today} audit log entries recorded today.`,
      fill_rate_pct      : `Current average event fill rate: ${result.fill_rate_pct}%.`,
      attendance_pct     : `Overall attendance rate: ${result.attendance_pct}%.`,
    };

    res.json({
      data: Object.fromEntries(
        Object.entries(result).map(([k, v]) => [k, { value: v, message: msgs[k] }])
      ),
      rowCount       : Object.keys(result).length,
      executionTimeMs,
    });
  } catch (err) {
    next(err);
  }
}
