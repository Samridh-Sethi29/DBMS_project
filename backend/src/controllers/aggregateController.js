// src/controllers/aggregateController.js
// Q3: GET /api/aggregate?table=&column=&fn=COUNT|SUM|AVG|MIN|MAX
// Supports ?format=xml for XML output.

import { readPool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { sendXml } from '../utils/xml.js';
import { badRequest } from '../middleware/errorHandler.js';
import {
  AGGREGATE_TABLES,
  AGGREGATE_COLUMNS,
  AGGREGATE_FNS,
} from '../utils/allowlists.js';

export async function aggregate(req, res, next) {
  try {
    const { table, column, fn } = req.query;

    // Validate from allowlists – no user input ever interpolated directly
    if (!table || !AGGREGATE_TABLES.has(table)) {
      return next(badRequest(`Invalid table. Allowed: ${[...AGGREGATE_TABLES].join(', ')}`));
    }
    const colSet = AGGREGATE_COLUMNS[table];
    if (!column || !colSet?.has(column)) {
      return next(badRequest(`Invalid column for table '${table}'. Allowed: ${[...colSet].join(', ')}`));
    }
    const safeFn = (fn || '').toUpperCase();
    if (!AGGREGATE_FNS.has(safeFn)) {
      return next(badRequest(`Invalid function. Allowed: ${[...AGGREGATE_FNS].join(', ')}`));
    }

    // Safe: table/column/fn all come from allowlists
    const sql = `SELECT ${safeFn}(\`${column}\`) AS result FROM \`${table}\``;

    const { result, executionTimeMs } = await timed(async () => {
      const [[row]] = await readPool.execute(sql);
      return row;
    });

    const payload = {
      data: { table, column, fn: safeFn, result: result.result },
      meta: {
        rowCount: 1,
        executionTimeMs,
      },
    };

    if (req.query.format === 'xml') return sendXml(res, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}
