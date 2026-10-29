// src/controllers/joinController.js
// Q5: GET /api/join?left=&right=&type=INNER|LEFT|RIGHT|FULL
// Only pre-defined FK pairs are allowed. FULL OUTER JOIN is emulated with UNION.

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { badRequest } from '../middleware/errorHandler.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { JOIN_TYPES, JOIN_MAP } from '../utils/allowlists.js';

export async function join(req, res, next) {
  try {
    const { left, right, type = 'INNER' } = req.query;
    const { page, pageSize, offset }       = parsePagination(req.query);

    const joinType = (type || '').toUpperCase();
    if (!JOIN_TYPES.has(joinType)) {
      return next(badRequest(`Invalid join type. Allowed: ${[...JOIN_TYPES].join(', ')}`));
    }

    const pairKey = `${left},${right}`;
    const pair    = JOIN_MAP[pairKey];
    if (!pair) {
      return next(badRequest(
        `No FK join defined for (${left}, ${right}). Allowed pairs: ${Object.keys(JOIN_MAP).join(' | ')}`
      ));
    }

    // Safe: left/right/cols come from allowlist; joinType from allowlist set
    const { leftCol, rightCol } = pair;

    const { result, executionTimeMs } = await timed(async () => {
      if (joinType === 'FULL') {
        // Emulate FULL OUTER JOIN with LEFT JOIN UNION RIGHT JOIN (MySQL has no FULL OUTER JOIN)
        const sql = `
          SELECT '${left}' AS source_left, l.*, r.*
          FROM \`${left}\` l
          LEFT JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
          UNION
          SELECT '${left}' AS source_left, l.*, r.*
          FROM \`${left}\` l
          RIGHT JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
          LIMIT ? OFFSET ?
        `;
        const [rows] = await readPool.execute(sql, [pageSize, offset]);

        const [[{ total }]] = await readPool.execute(`
          SELECT COUNT(*) AS total FROM (
            SELECT l.\`${leftCol}\`
            FROM \`${left}\` l LEFT JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
            UNION
            SELECT l.\`${leftCol}\`
            FROM \`${left}\` l RIGHT JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
          ) sub
        `);
        return { rows, total };
      }

      const sql = `
        SELECT l.*, r.*
        FROM \`${left}\` l
        ${joinType} JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
        LIMIT ? OFFSET ?
      `;
      const [rows] = await readPool.execute(sql, [pageSize, offset]);

      const countSql = `
        SELECT COUNT(*) AS total
        FROM \`${left}\` l
        ${joinType} JOIN \`${right}\` r ON l.\`${leftCol}\` = r.\`${rightCol}\`
      `;
      const [[{ total }]] = await readPool.execute(countSql);
      return { rows, total };
    });

    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}
