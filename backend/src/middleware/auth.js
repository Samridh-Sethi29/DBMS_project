// src/middleware/auth.js
// JWT authentication + role-based access control + club rank lookup middleware.

import jwt from 'jsonwebtoken';
import { readPool } from '../config/db.js';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * requireAuth – verifies Bearer token and attaches decoded payload to req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({
      error: {
        code   : 'UNAUTHORIZED',
        message: 'Authentication token is required.',
      },
    });
  }
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: {
        code   : 'INVALID_TOKEN',
        message: 'Invalid or expired token.',
      },
    });
  }
}

/**
 * requireRole(...roles) – must be used after requireAuth.
 * Valid roles are 'user' and 'admin'.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code   : 'FORBIDDEN',
          message: `Access denied. Required role(s): ${roles.join(', ')}.`,
        },
      });
    }
    next();
  };
}

/**
 * Queries fn_club_rank(club_id, user_id) from the database on a per-request basis.
 * Returns integer: 0 (none), 1 (member), 2 (core), 3 (vice chair), 4 (chair), 5 (admin)
 */
export async function getClubRank(clubId, userId) {
  if (!clubId || !userId) return 0;
  const [[row]] = await readPool.execute(
    'SELECT fn_club_rank(?, ?) AS club_rank',
    [Number(clubId), Number(userId)],
  );
  return Number(row?.club_rank ?? 0);
}

/**
 * requireClubRank(minRank, getClubIdFn)
 * Enforces per-request DB lookup of user's club permissions.
 * Never trusts JWT for club roles.
 */
export function requireClubRank(minRank, getClubId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }
      // If global admin, immediately permit
      if (req.user.role === 'admin') return next();

      const clubId = typeof getClubId === 'function' ? await getClubId(req) : (req.params.clubId || req.params.id || req.body.club_id);
      if (!clubId) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'Club ID could not be determined.' },
        });
      }

      const rank = await getClubRank(clubId, req.user.userId);
      if (rank < minRank) {
        return res.status(403).json({
          error: {
            code   : 'INSUFFICIENT_CLUB_PERMISSIONS',
            message: `Requires club rank >= ${minRank}. Your rank: ${rank}.`,
          },
        });
      }

      req.clubRank = rank;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * signToken – creates a JWT from a user record.
 */
export function signToken(user) {
  return jwt.sign(
    { userId: user.user_id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}
