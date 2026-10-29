// src/utils/pagination.js
// Shared pagination helpers used by all list endpoints.

/**
 * Parses ?page and ?pageSize from query string.
 * pageSize is capped at 100.
 * Returns { page, pageSize, offset }.
 */
export function parsePagination(query) {
  const page     = Math.max(1, parseInt(query.page     || '1',  10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize || '20', 10) || 20));
  const offset   = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

/**
 * Builds a standard paginated response envelope.
 */
export function paginated({ data, total, page, pageSize, executionTimeMs }) {
  return {
    data,
    rowCount       : data.length,
    total,
    page,
    pageSize,
    totalPages     : Math.ceil(total / pageSize),
    executionTimeMs,
  };
}
