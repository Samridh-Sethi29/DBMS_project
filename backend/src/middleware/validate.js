// src/middleware/validate.js
// Zod-based request validation factory.
// Returns { error: { code, message, fields } } on validation failure.

import { ZodError } from 'zod';
import { zodErrors } from '../utils/zodErrors.js';

/**
 * validate(schema, source = 'body') – validates req[source] against a Zod schema.
 * On failure returns 422 with per-field error messages in standard envelope.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          error: {
            code   : 'VALIDATION_ERROR',
            message: 'Validation failed.',
            fields : zodErrors(err.issues),
          },
        });
      }
      next(err);
    }
  };
}
