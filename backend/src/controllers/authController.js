// src/controllers/authController.js
// Handles user registration and login.
// Password hashing uses bcrypt; tokens are signed JWTs.

import bcrypt from 'bcrypt';
import { writePool, readPool } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { timed } from '../middleware/timing.js';

const SALT_ROUNDS = 12;

// POST /auth/register
// Always creates a user with role 'user' and creates the corresponding students record
// in the same transaction using sp_insert_student. Any "role" in req.body is ignored.
export async function register(req, res, next) {
  const {
    name,
    email,
    password,
    roll_no,
    department_id,
    year_of_study,
    phone = null,
  } = req.body;

  let conn;
  try {
    const { result: hash, executionTimeMs: hashMs } = await timed(() =>
      bcrypt.hash(password, SALT_ROUNDS)
    );

    conn = await writePool.getConnection();

    const { result: studentId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_sid = 0');
      await conn.execute(
        'CALL sp_insert_student(?, ?, ?, ?, ?, ?, ?, @out_sid)',
        [name, email, hash, roll_no, department_id, year_of_study, phone || null],
      );
      const [outRows] = await conn.execute('SELECT @out_sid AS out_sid');
      return outRows[0]?.out_sid;
    });

    res.status(201).json({
      data: {
        userId   : studentId,
        studentId,
        name,
        email,
        role     : 'user',
        roll_no  : roll_no.toUpperCase(),
        phone    : phone || null,
        department_id,
        year_of_study,
      },
      meta: {
        rowCount       : 1,
        executionTimeMs: executionTimeMs + hashMs,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// POST /auth/login
export async function login(req, res, next) {
  const { email, password } = req.body;
  try {
    const { result: rows, executionTimeMs } = await timed(async () => {
      const [r] = await readPool.execute(
        'CALL sp_user_get_for_login(:email)',
        { email },
      );
      return r[0]; // result set from the procedure
    });

    const user = rows?.[0];
    if (!user || !user.is_active) {
      return res.status(401).json({
        error: {
          code   : 'INVALID_CREDENTIALS',
          message: 'Invalid credentials or account inactive.',
        },
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        error: {
          code   : 'INVALID_CREDENTIALS',
          message: 'Invalid credentials.',
        },
      });
    }

    const token = signToken(user);
    const [[student]] = await readPool.execute(
      'SELECT roll_no, phone FROM students WHERE student_id = ?',
      [user.user_id],
    );
    res.json({
      data: {
        token,
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(student && { roll_no: student.roll_no, phone: student.phone }),
      },
      meta: {
        rowCount: 1,
        executionTimeMs,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const { result: rows, executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT u.user_id, u.name, u.email, u.role, s.student_id, s.roll_no, s.phone
         FROM users u
         LEFT JOIN students s ON s.student_id = u.user_id
         WHERE u.user_id = ?`,
        [req.user.userId],
      )
    );
    const [users] = rows;
    const [user] = users;
    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found.' },
      });
    }

    res.json({
      data: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...(user.student_id !== null && { roll_no: user.roll_no, phone: user.phone }),
      },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

export async function myRegistrations(req, res, next) {
  try {
    const { result: [rows], executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT
           r.registration_id AS registrationId,
           r.event_id        AS eventId,
           e.title           AS eventTitle,
           e.start_datetime  AS startDatetime,
           e.status          AS eventStatus,
           v.name            AS venue,
           r.status,
           r.registered_at   AS registeredAt
         FROM registrations r
         JOIN events e ON e.event_id = r.event_id
         JOIN venues v ON v.venue_id = e.venue_id
         WHERE r.student_id = ?
         ORDER BY r.registered_at DESC, r.registration_id DESC`,
        [req.user.userId],
      )
    );

    res.json({
      data: rows.map(row => ({
        ...row,
        startDatetime: row.startDatetime ? new Date(row.startDatetime).toISOString() : null,
        registeredAt: row.registeredAt ? new Date(row.registeredAt).toISOString() : null,
      })),
      meta: { rowCount: rows.length, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}
