// src/controllers/subqueryController.js
// Q6: GET /api/subquery?option=<named_option>[&club_id=]
// Each option is a hardcoded query (no user-supplied SQL ever runs).

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { badRequest } from '../middleware/errorHandler.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { SUBQUERY_OPTIONS } from '../utils/allowlists.js';

export async function subquery(req, res, next) {
  try {
    const { option, club_id } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);

    if (!option || !SUBQUERY_OPTIONS.has(option)) {
      return next(badRequest(
        `Invalid option. Allowed: ${[...SUBQUERY_OPTIONS].join(', ')}`
      ));
    }

    const { result, executionTimeMs } = await timed(async () => {
      let rows, total;

      // ------------------------------------------------------------------
      // Option A: students registered for events of a specific club
      // ------------------------------------------------------------------
      if (option === 'students_in_club_events') {
        if (!club_id) throw Object.assign(new Error('club_id is required for this option.'), { status: 400 });

        [[{ total }]] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ COUNT(DISTINCT s.student_id) AS total
           FROM students s
           WHERE s.student_id IN (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ r.student_id
             FROM   registrations r
             WHERE  r.event_id IN (
               SELECT /*+ MAX_EXECUTION_TIME(8000) */ e.event_id FROM events e WHERE e.club_id = ?
             )
           )`,
          [club_id],
        );

        [rows] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ s.student_id, u.name, u.email, s.roll_no, d.name AS department_name
           FROM   students s
           JOIN   users       u ON u.user_id       = s.student_id
           JOIN   departments d ON d.department_id  = s.department_id
           WHERE  s.student_id IN (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ r.student_id
             FROM   registrations r
             WHERE  r.event_id IN (
               SELECT /*+ MAX_EXECUTION_TIME(8000) */ e.event_id FROM events e WHERE e.club_id = ?
             )
           )
           LIMIT ? OFFSET ?`,
          [club_id, pageSize, offset],
        );
      }

      // ------------------------------------------------------------------
      // Option B: clubs with above-average approved membership count
      // ------------------------------------------------------------------
      else if (option === 'clubs_above_avg_membership') {
        [[{ total }]] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ COUNT(*) AS total
           FROM (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ club_id, COUNT(*) AS cnt
             FROM   club_members
             WHERE  status = 'approved'
             GROUP BY club_id
             HAVING cnt > (
               SELECT /*+ MAX_EXECUTION_TIME(8000) */ AVG(sub.member_count)
               FROM (
                 SELECT /*+ MAX_EXECUTION_TIME(8000) */ COUNT(*) AS member_count
                 FROM   club_members
                 WHERE  status = 'approved'
                 GROUP BY club_id
               ) sub
             )
           ) t`
        );

        [rows] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ c.club_id, c.name AS club_name, c.status,
                  COUNT(cm.student_id) AS approved_members
           FROM   clubs c
           JOIN   club_members cm ON cm.club_id = c.club_id AND cm.status = 'approved'
           GROUP BY c.club_id, c.name, c.status
           HAVING approved_members > (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ AVG(sub.member_count)
             FROM (
               SELECT /*+ MAX_EXECUTION_TIME(8000) */ COUNT(*) AS member_count
               FROM   club_members
               WHERE  status = 'approved'
               GROUP BY club_id
             ) sub
           )
           ORDER BY approved_members DESC
           LIMIT ? OFFSET ?`,
          [pageSize, offset],
        );
      }

      // ------------------------------------------------------------------
      // Option C: events with no registrations
      // ------------------------------------------------------------------
      else if (option === 'events_no_registrations') {
        [[{ total }]] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ COUNT(*) AS total
           FROM events e
           WHERE NOT EXISTS (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ 1 FROM registrations r WHERE r.event_id = e.event_id
           )`
        );

        [rows] = await readPool.execute(
          `SELECT /*+ MAX_EXECUTION_TIME(8000) */ e.event_id, e.title, e.event_type, e.start_datetime, e.status,
                  c.name AS club_name
           FROM   events e
           JOIN   clubs c ON c.club_id = e.club_id
           WHERE  NOT EXISTS (
             SELECT /*+ MAX_EXECUTION_TIME(8000) */ 1 FROM registrations r WHERE r.event_id = e.event_id
           )
           ORDER BY e.start_datetime DESC
           LIMIT ? OFFSET ?`,
          [pageSize, offset],
        );
      }

      return { rows, total };
    });

    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}
