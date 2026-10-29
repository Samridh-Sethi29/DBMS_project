// src/controllers/studentsController.js
// CRUD for students via sp_insert_student / sp_update_student / sp_delete_student.

import { readPool, writePool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { notFound } from '../middleware/errorHandler.js';

// GET /api/students
export async function listStudents(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);

    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute(
        'SELECT COUNT(*) AS total FROM students s JOIN users u ON u.user_id = s.student_id WHERE u.is_active = 1'
      );
      const [rows] = await readPool.execute(
        `SELECT s.*, u.name, u.email, u.role, d.name AS department_name
         FROM students s
         JOIN users       u ON u.user_id       = s.student_id
         JOIN departments d ON d.department_id  = s.department_id
         WHERE u.is_active = 1
         ORDER BY s.student_id
         LIMIT ? OFFSET ?`,
        [pageSize, offset],
      );
      return { rows, total };
    });

    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

// GET /api/students/:id
export async function getStudent(req, res, next) {
  try {
    const { result, executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT s.*, u.name, u.email, u.role, d.name AS department_name
         FROM students s
         JOIN users       u ON u.user_id       = s.student_id
         JOIN departments d ON d.department_id  = s.department_id
         WHERE s.student_id = ?`,
        [req.params.id],
      )
    );
    const [rows] = result;
    if (!rows.length) return next(notFound('Student not found.'));
    res.json({
      data: rows[0],
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/students
export async function createStudent(req, res, next) {
  let conn;
  try {
    const { name, email, password_hash, roll_no, department_id, year_of_study, phone } = req.body;

    conn = await writePool.getConnection();
    const { result: studentId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_sid = 0');
      await conn.execute(
        `CALL sp_insert_student(:name, :email, :password_hash, :roll_no,
          :department_id, :year_of_study, :phone, @out_sid)`,
        { name, email, password_hash, roll_no, department_id, year_of_study, phone: phone || null },
      );
      const [[{ out_sid }]] = await conn.execute('SELECT @out_sid AS out_sid');
      return out_sid;
    });

    const [[student]] = await readPool.execute(
      `SELECT s.*, u.name, u.email, d.name AS department_name
       FROM students s
       JOIN users u ON u.user_id = s.student_id
       JOIN departments d ON d.department_id = s.department_id
       WHERE s.student_id = ?`, [studentId]
    );
    res.status(201).json({
      data: student,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// PUT /api/students/:id
export async function updateStudent(req, res, next) {
  let conn;
  try {
    const studentId = parseInt(req.params.id, 10);
    const { name, email, roll_no, department_id, year_of_study, phone } = req.body;

    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute(
        'CALL sp_update_student(:student_id, :name, :email, :roll_no, :department_id, :year_of_study, :phone)',
        { student_id: studentId, name, email, roll_no, department_id, year_of_study, phone: phone || null },
      )
    );

    const [[student]] = await readPool.execute(
      `SELECT s.*, u.name, u.email, d.name AS department_name
       FROM students s JOIN users u ON u.user_id = s.student_id
       JOIN departments d ON d.department_id = s.department_id
       WHERE s.student_id = ?`, [studentId]
    );
    res.json({
      data: student,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// DELETE /api/students/:id (soft delete)
export async function deleteStudent(req, res, next) {
  let conn;
  try {
    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute('CALL sp_delete_student(:id)', { id: req.params.id })
    );
    res.json({
      data: { deleted: true },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}
