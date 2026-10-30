// src/controllers/reportsController.js
// GET /api/reports/participation  – from v_event_participation
// GET /api/reports/membership     – from v_club_membership
// GET /api/reports/student/:id    – from v_student_history

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { badRequest, notFound } from '../middleware/errorHandler.js';

export async function participation(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM v_event_participation');
      const [rows] = await readPool.execute(
        'SELECT * FROM v_event_participation ORDER BY event_id DESC LIMIT ? OFFSET ?',
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
        'SELECT * FROM v_club_membership ORDER BY approved_members DESC, club_id ASC LIMIT ? OFFSET ?',
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
        'SELECT * FROM v_student_history WHERE student_id = ? ORDER BY start_datetime DESC LIMIT ? OFFSET ?',
        [studentId, pageSize, offset],
      );
      return { rows, total };
    });

    if (!result.total) {
      // Check if student exists in students table
      const [[st]] = await readPool.execute('SELECT student_id FROM students WHERE student_id = ?', [studentId]);
      if (!st) return next(notFound('Student not found.'));
    }

    const data = req.user.role === 'admin'
      ? result.rows
      : result.rows.map(({ email, roll_no, phone, ...selfServiceData }) => selfServiceData);
    res.json(paginated({ data, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}
