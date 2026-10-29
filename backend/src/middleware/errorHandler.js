// src/middleware/errorHandler.js
// Central error handler – maps MySQL / application errors to HTTP responses.
// No stack traces in production responses.

/**
 * Maps MySQL SIGNAL SQLSTATE '45000' messages and ER_* codes to HTTP statuses.
 */
export function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // ── MySQL SIGNAL SQLSTATE '45000'  →  extracted from message ──────────────
  if (err.sqlState === '45000') {
    const status = err.message.toLowerCase().includes('not found') ? 404 : 409;
    return res.status(status).json({ error: err.message });
  }

  // ── MySQL Duplicate Entry ─────────────────────────────────────────────────
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry: ' + (err.sqlMessage || err.message) });
  }

  // ── FK violation (insert/update referencing non-existent parent) ──────────
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ error: 'Referenced record does not exist.' });
  }

  // ── FK violation (delete/update parent that has children) ─────────────────
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ error: 'Record is referenced by other data and cannot be deleted.' });
  }

  // ── Application-level 400 errors (thrown explicitly) ─────────────────────
  if (err.status === 400 || err.status === 404) {
    return res.status(err.status).json({ error: err.message });
  }

  // ── Everything else → 500 ─────────────────────────────────────────────────
  console.error('[ERROR]', err);
  return res.status(500).json({
    error: 'Internal server error.',
    ...(isDev && { detail: err.message }),
  });
}

/** Convenience: create a 400 error */
export function badRequest(message) {
  const e  = new Error(message);
  e.status = 400;
  return e;
}

/** Convenience: create a 404 error */
export function notFound(message = 'Resource not found.') {
  const e  = new Error(message);
  e.status = 404;
  return e;
}
