// src/middleware/timing.js
// Attaches a high-resolution timer to every request; exposes helpers.

/**
 * Attaches req.startHr (BigInt nanoseconds) so controllers can compute
 * elapsed time accurately.
 */
export function timing(req, _res, next) {
  req.startHr = process.hrtime.bigint();
  next();
}

/**
 * Returns elapsed milliseconds (2 decimal places) since req.startHr.
 */
export function elapsedMs(req) {
  const ns = process.hrtime.bigint() - req.startHr;
  return Number(ns) / 1_000_000;
}

/**
 * Wraps an async query function and returns { rows, executionTimeMs }.
 * @param {() => Promise<any[]>} fn  – async function that returns a rows array
 */
export async function timed(fn) {
  const t0 = process.hrtime.bigint();
  const result = await fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1_000_000;
  return { result, executionTimeMs: Math.round(ms * 100) / 100 };
}
