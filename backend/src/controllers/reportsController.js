// src/controllers/reportsController.js
// GET /api/reports/participation  – from v_event_participation
// GET /api/reports/membership     – from v_club_membership
// GET /api/reports/student/:id    – from v_student_history

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { badRequest } from '../middleware/errorHandler.js';

export async function participation(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM v_event_participation');
      const [rows] = await readPool.execute(
        'SELECT * FROM v_event_participation ORDER BY start_datetime DESC LIMIT ? OFFSET ?',
        [pageSize, offset],
      );
      return { rows, total };
    });
    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

export async function membership(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM v_club_membership');
      const [rows] = await readPool.execute(
        'SELECT * FROM v_club_membership ORDER BY total_members DESC LIMIT ? OFFSET ?',
        [pageSize, offset],
      );
      return { rows, total };
    });
    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

export async function studentHistory(req, res, next) {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (!studentId) return next(badRequest('Invalid student ID.'));

    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute(
        'SELECT COUNT(*) AS total FROM v_student_history WHERE student_id = ?',
        [studentId],
      );
      const [rows] = await readPool.execute(
        'SELECT * FROM v_student_history WHERE student_id = ? LIMIT ? OFFSET ?',
        [studentId, pageSize, offset],
      );
      return { rows, total };
    });

    if (!result.total) return next(badRequest('Student not found.'));
    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}
