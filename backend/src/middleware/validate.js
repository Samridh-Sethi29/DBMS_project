// src/middleware/validate.js
// Zod-based request validation factory.

import { ZodError } from 'zod';

/**
 * validate(schema) – validates req.body against a Zod schema.
 * On failure returns 422 with per-field error messages.
 */
export function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          error : 'Validation failed.',
          fields: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
        });
      }
      next(err);
    }
  };
}
