// src/middleware/errorHandler.js
// Central error handler – maps MySQL / application errors to standard HTTP responses.
// Consistent response envelope: { error: { code, message } }
// No stack traces returned to clients.

function mapSignalError(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('venue is already booked')) {
    return { status: 409, code: 'VENUE_CONFLICT' };
  }
  if (lower.includes('this club already has a chair')) {
    return { status: 409, code: 'CHAIR_EXISTS' };
  }
  if (lower.includes('event is full') || lower.includes('fully booked')) {
    return { status: 409, code: 'EVENT_FULL' };
  }
  if (lower.includes('deadline has passed')) {
    return { status: 409, code: 'DEADLINE_PASSED' };
  }
  if (lower.includes('already registered')) {
    return { status: 409, code: 'ALREADY_REGISTERED' };
  }
  if (lower.includes('already exists') || lower.includes('already taken')) {
    return { status: 409, code: 'DUPLICATE_ENTRY' };
  }
  if (lower.includes('mondays between 2 pm and 4 pm')) {
    return { status: 403, code: 'OFFICE_HOURS_RESTRICTION' };
  }
  if (lower.includes('only an admin') || lower.includes('only a chair')) {
    return { status: 403, code: 'INSUFFICIENT_PERMISSIONS' };
  }
  if (lower.includes('not found')) {
    return { status: 404, code: 'NOT_FOUND' };
  }
  if (lower.includes('exceeds venue capacity')) {
    return { status: 400, code: 'CAPACITY_EXCEEDED' };
  }
  if (lower.includes('must be an approved club member')) {
    return { status: 400, code: 'MEMBER_NOT_APPROVED' };
  }
  if (lower.includes('blank') || lower.includes('invalid') || lower.includes('must')) {
    return { status: 400, code: 'VALIDATION_ERROR' };
  }
  return { status: 400, code: 'SQLSTATE_45000' };
}

export function errorHandler(err, req, res, _next) {
  // ── MySQL SIGNAL SQLSTATE '45000' ──────────────────────────────────────────
  if (err.sqlState === '45000') {
    const { status, code } = mapSignalError(err.message || '');
    return res.status(status).json({
      error: {
        code,
        message: err.message,
      },
    });
  }

  // ── MySQL Duplicate Entry ─────────────────────────────────────────────────
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'Duplicate entry: ' + (err.sqlMessage || err.message),
      },
    });
  }

  // ── FK violation (insert/update referencing non-existent parent) ──────────
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced record does not exist.',
      },
    });
  }

  // ── FK violation (delete/update parent that has children) ─────────────────
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({
      error: {
        code: 'ROW_IS_REFERENCED',
        message: 'Record is referenced by other data and cannot be deleted.',
      },
    });
  }

  // ── Explicit application errors ───────────────────────────────────────────
  if (err.status) {
    const defaultCodes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
    };
    return res.status(err.status).json({
      error: {
        code: err.code || defaultCodes[err.status] || 'ERROR',
        message: err.message,
        ...(err.fields && { fields: err.fields }),
      },
    });
  }

  // ── Unhandled error → 500 ─────────────────────────────────────────────────
  console.error('[ERROR]', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error.',
    },
  });
}

export function badRequest(message, code = 'BAD_REQUEST') {
  const e = new Error(message);
  e.status = 400;
  e.code = code;
  return e;
}

export function notFound(message = 'Resource not found.', code = 'NOT_FOUND') {
  const e = new Error(message);
  e.status = 404;
  e.code = code;
  return e;
}

export function forbidden(message = 'Access denied.', code = 'FORBIDDEN') {
  const e = new Error(message);
  e.status = 403;
  e.code = code;
  return e;
}

export function unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
  const e = new Error(message);
  e.status = 401;
  e.code = code;
  return e;
}
