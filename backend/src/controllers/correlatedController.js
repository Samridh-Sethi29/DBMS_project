// src/controllers/correlatedController.js
// Q7: GET /api/correlated?option=<named_option>
// Correlated subqueries – all SQL is hardcoded server-side.

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { badRequest } from '../middleware/errorHandler.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { CORRELATED_OPTIONS } from '../utils/allowlists.js';

export async function correlated(req, res, next) {
  try {
    const { option } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query);

    if (!option || !CORRELATED_OPTIONS.has(option)) {
      return next(badRequest(
        `Invalid option. Allowed: ${[...CORRELATED_OPTIONS].join(', ')}`
      ));
    }

    const { result, executionTimeMs } = await timed(async () => {
      let rows, total;

      // ------------------------------------------------------------------
      // Option A: Events whose registration count exceeds their club's average
      // ------------------------------------------------------------------
      if (option === 'events_above_club_avg') {
        [[{ total }]] = await readPool.execute(`
          SELECT COUNT(*) AS total
          FROM events e
          WHERE (
            SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id
          ) > (
            SELECT AVG(sub.cnt)
            FROM (
              SELECT COUNT(*) AS cnt
              FROM   events e2
              JOIN   registrations r2 ON r2.event_id = e2.event_id
              WHERE  e2.club_id = e.club_id
              GROUP BY e2.event_id
            ) sub
          )
        `);

        [rows] = await readPool.execute(`
          SELECT
            e.event_id,
            e.title,
            e.event_type,
            e.start_datetime,
            c.name AS club_name,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id) AS reg_count,
            (
              SELECT AVG(sub.cnt)
              FROM (
                SELECT COUNT(*) AS cnt
                FROM   events e2
                JOIN   registrations r2 ON r2.event_id = e2.event_id
                WHERE  e2.club_id = e.club_id
                GROUP BY e2.event_id
              ) sub
            ) AS club_avg_regs
          FROM  events e
          JOIN  clubs  c ON c.club_id = e.club_id
          WHERE (
            SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.event_id
          ) > (
            SELECT AVG(sub.cnt)
            FROM (
              SELECT COUNT(*) AS cnt
              FROM   events e2
              JOIN   registrations r2 ON r2.event_id = e2.event_id
              WHERE  e2.club_id = e.club_id
              GROUP BY e2.event_id
            ) sub
          )
          ORDER BY reg_count DESC
          LIMIT ? OFFSET ?
        `, [pageSize, offset]);
      }

      // ------------------------------------------------------------------
      // Option B: Students registered for more events than the average student
      // ------------------------------------------------------------------
      else if (option === 'students_above_avg_events') {
        [[{ total }]] = await readPool.execute(`
          SELECT COUNT(*) AS total
          FROM students s
          WHERE (
            SELECT COUNT(*) FROM registrations r
            WHERE  r.student_id = s.student_id AND r.status = 'registered'
          ) > (
            SELECT AVG(cnt)
            FROM (
              SELECT COUNT(*) AS cnt
              FROM   registrations
              WHERE  status = 'registered'
              GROUP BY student_id
            ) sub
          )
        `);

        [rows] = await readPool.execute(`
          SELECT
            s.student_id,
            u.name AS student_name,
            u.email,
            s.roll_no,
            d.name AS department_name,
            (
              SELECT COUNT(*) FROM registrations r
              WHERE  r.student_id = s.student_id AND r.status = 'registered'
            ) AS event_count,
            (
              SELECT AVG(cnt)
              FROM (
                SELECT COUNT(*) AS cnt
                FROM   registrations
                WHERE  status = 'registered'
                GROUP BY student_id
              ) sub
            ) AS avg_event_count
          FROM  students   s
          JOIN  users       u ON u.user_id      = s.student_id
          JOIN  departments d ON d.department_id = s.department_id
          WHERE (
            SELECT COUNT(*) FROM registrations r
            WHERE  r.student_id = s.student_id AND r.status = 'registered'
          ) > (
            SELECT AVG(cnt)
            FROM (
              SELECT COUNT(*) AS cnt
              FROM   registrations
              WHERE  status = 'registered'
              GROUP BY student_id
            ) sub
          )
          ORDER BY event_count DESC
          LIMIT ? OFFSET ?
        `, [pageSize, offset]);
      }

      return { rows, total };
    });

    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}
