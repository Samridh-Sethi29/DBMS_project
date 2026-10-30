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

export function requireSelfOrAdmin(req, res, next) {
  if (req.user?.role === 'admin'
      || Number(req.user?.userId) === Number(req.params.id)) {
    return next();
  }
  return res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Access denied. You may only access your own student record.',
    },
  });
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
 * Enforces per-request DB lookup of user's club permissions for creation routes
 * where the club_id is provided in the body or query.
 */
export function requireClubRank(minRank, getClubId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }
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

      req.clubId = clubId;
      req.clubRank = rank;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * requireEntityClubRank(entityType, minRank)
 * Loads the resource row from the database, extracts club_id from that row,
 * attaches req.clubId = club_id, and checks fn_club_rank(club_id, req.user.userId) >= minRank.
 * NEVER trusts club_id from req.body for PUT/DELETE/attendance/certificates.
 */
export function requireEntityClubRank(entityType, minRank) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        });
      }

      const id = entityType === 'club'
        ? parseInt(req.params.clubId || req.params.id, 10)
        : parseInt(req.params.id || req.params.eventId || req.params.photoId, 10);

      if (!id) {
        return res.status(400).json({
          error: { code: 'BAD_REQUEST', message: `Invalid ${entityType} ID parameter.` },
        });
      }

      let clubId = null;

      if (entityType === 'event') {
        const [[event]] = await readPool.execute(
          'SELECT club_id FROM events WHERE event_id = ?',
          [id],
        );
        if (!event) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Event not found.' },
          });
        }
        clubId = event.club_id;
      } else if (entityType === 'photo') {
        const [[photo]] = await readPool.execute(
          'SELECT e.club_id FROM event_photos ep JOIN events e ON e.event_id = ep.event_id WHERE ep.photo_id = ?',
          [id],
        );
        if (!photo) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Event photo not found.' },
          });
        }
        clubId = photo.club_id;
      } else if (entityType === 'club') {
        const clubParamId = parseInt(req.params.clubId || req.params.id, 10);
        const [[club]] = await readPool.execute(
          'SELECT club_id FROM clubs WHERE club_id = ?',
          [clubParamId],
        );
        if (!club) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Club not found.' },
          });
        }
        clubId = club.club_id;
      }

      // Always set req.resolvedClubId (and req.clubId for backward compatibility)
      req.resolvedClubId = clubId;
      req.clubId = clubId;

      // No admin shortcut: entity is loaded above (404 if missing) and fn_club_rank decides
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
