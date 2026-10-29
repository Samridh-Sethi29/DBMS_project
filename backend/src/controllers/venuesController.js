// src/controllers/venuesController.js
// CRUD for venues via stored procedures.

import { readPool, writePool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { notFound } from '../middleware/errorHandler.js';

export async function listVenues(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM venues');
      const [rows] = await readPool.execute(
        'SELECT * FROM venues ORDER BY venue_id LIMIT ? OFFSET ?',
        [pageSize, offset],
      );
      return { rows, total };
    });
    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

export async function getVenue(req, res, next) {
  try {
    const { result, executionTimeMs } = await timed(() =>
      readPool.execute('SELECT * FROM venues WHERE venue_id = ?', [req.params.id])
    );
    const [rows] = result;
    if (!rows.length) return next(notFound('Venue not found.'));
    res.json({
      data: rows[0],
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

export async function createVenue(req, res, next) {
  let conn;
  try {
    const { name, location = null, capacity } = req.body;
    conn = await writePool.getConnection();
    const { result: venueId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_vid = 0');
      await conn.execute(
        'CALL sp_insert_venue(:name, :location, :capacity, @out_vid)',
        { name, location, capacity },
      );
      const [[{ out_vid }]] = await conn.execute('SELECT @out_vid AS out_vid');
      return out_vid;
    });
    const [[venue]] = await readPool.execute('SELECT * FROM venues WHERE venue_id = ?', [venueId]);
    res.status(201).json({
      data: venue,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

export async function updateVenue(req, res, next) {
  let conn;
  try {
    const venueId = parseInt(req.params.id, 10);
    const { name, location = null, capacity } = req.body;
    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute(
        'CALL sp_update_venue(:venue_id, :name, :location, :capacity)',
        { venue_id: venueId, name, location, capacity },
      )
    );
    const [[venue]] = await readPool.execute('SELECT * FROM venues WHERE venue_id = ?', [venueId]);
    res.json({
      data: venue,
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

export async function deleteVenue(req, res, next) {
  let conn;
  try {
    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute('CALL sp_delete_venue(:id)', { id: req.params.id })
    );
    res.json({
      data: { deleted: true },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}
