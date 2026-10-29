// src/controllers/authController.js
// Handles user registration and login.
// Password hashing uses bcrypt; tokens are signed JWTs.

import bcrypt from 'bcrypt';
import { writePool, readPool } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { timed } from '../middleware/timing.js';

const SALT_ROUNDS = 12;

// POST /auth/register
export async function register(req, res, next) {
  const { name, email, password, role = 'user' } = req.body;
  let conn;
  try {
    const { result: hash, executionTimeMs: hashMs } = await timed(() =>
      bcrypt.hash(password, SALT_ROUNDS)
    );

    conn = await writePool.getConnection();

    const { result: userId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_id = 0');
      await conn.execute(
        'CALL sp_user_register(:name, :email, :hash, :role, @out_id)',
        { name, email, hash, role },
      );
      const [[{ out_id }]] = await conn.execute('SELECT @out_id AS out_id');
      return out_id;
    });

    res.status(201).json({
      data: { userId, name, email, role },
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
    res.json({
      data: { token, userId: user.user_id, name: user.name, role: user.role },
      meta: {
        rowCount: 1,
        executionTimeMs,
      },
    });
  } catch (err) {
    next(err);
  }
}
