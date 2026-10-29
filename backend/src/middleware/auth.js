// src/middleware/auth.js
// JWT authentication + role-based access control middleware.

import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

/**
 * requireAuth – verifies Bearer token and attaches decoded payload to req.user.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * requireRole(...roles) – must be used after requireAuth.
 * Accepts one or more role strings.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }
    next();
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
