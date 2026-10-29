// src/controllers/clubsController.js
// CRUD for clubs via stored procedures.

import { readPool, writePool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { badRequest } from '../middleware/errorHandler.js';

// GET /api/clubs
export async function listClubs(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM clubs');
      const [rows] = await readPool.execute(
        `SELECT c.*, cc.name AS category_name, u.name AS coordinator_name
         FROM clubs c
         JOIN club_categories cc ON cc.category_id  = c.category_id
         JOIN users           u  ON u.user_id        = c.coordinator_id
         ORDER BY c.club_id
         LIMIT ? OFFSET ?`,
        [pageSize, offset],
      );
      return { rows, total };
    });
    res.json(paginated({ data: result.rows, total: result.total, page, pageSize, executionTimeMs }));
  } catch (err) {
    next(err);
  }
}

// GET /api/clubs/:id
export async function getClub(req, res, next) {
  try {
    const { result, executionTimeMs } = await timed(() =>
      readPool.execute(
        `SELECT c.*, cc.name AS category_name, u.name AS coordinator_name
         FROM clubs c
         JOIN club_categories cc ON cc.category_id = c.category_id
         JOIN users           u  ON u.user_id       = c.coordinator_id
         WHERE c.club_id = ?`,
        [req.params.id],
      )
    );
    const [rows] = result;
    if (!rows.length) return next(badRequest('Club not found.'));
    res.json({ data: rows[0], rowCount: 1, executionTimeMs });
  } catch (err) {
    next(err);
  }
}

// POST /api/clubs
export async function createClub(req, res, next) {
  let conn;
  try {
    const { name, description, category_id, coordinator_id } = req.body;
    conn = await writePool.getConnection();
    const { result: clubId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_cid = 0');
      await conn.execute(
        'CALL sp_insert_club(:name, :description, :category_id, :coordinator_id, @out_cid)',
        { name, description, category_id, coordinator_id },
      );
      const [[{ out_cid }]] = await conn.execute('SELECT @out_cid AS out_cid');
      return out_cid;
    });
    const [[club]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    res.status(201).json({ data: club, rowCount: 1, executionTimeMs });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// PUT /api/clubs/:id
export async function updateClub(req, res, next) {
  let conn;
  try {
    const clubId = parseInt(req.params.id, 10);
    const { name, description, category_id, coordinator_id, status } = req.body;
    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute(
        'CALL sp_update_club(:club_id, :name, :description, :category_id, :coordinator_id, :status)',
        { club_id: clubId, name, description, category_id, coordinator_id, status },
      )
    );
    const [[club]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    res.json({ data: club, rowCount: 1, executionTimeMs });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}

// DELETE /api/clubs/:id (soft delete → sets status = inactive)
export async function deleteClub(req, res, next) {
  let conn;
  try {
    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute('CALL sp_delete_club(:id)', { id: req.params.id })
    );
    res.json({ data: { deactivated: true }, rowCount: 1, executionTimeMs });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}
