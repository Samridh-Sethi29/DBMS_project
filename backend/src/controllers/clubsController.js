// src/controllers/clubsController.js
// CRUD for clubs via stored procedures.

import { readPool, writePool } from '../config/db.js';
import { timed } from '../middleware/timing.js';
import { parsePagination, paginated } from '../utils/pagination.js';
import { notFound } from '../middleware/errorHandler.js';

function sanitizeDescription(desc) {
  if (typeof desc !== 'string') return desc;
  return desc.replace(/<[^>]*>/g, '').trim();
}

// GET /api/clubs
export async function listClubs(req, res, next) {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const { result, executionTimeMs } = await timed(async () => {
      const [[{ total }]] = await readPool.execute('SELECT COUNT(*) AS total FROM clubs');
      const [rows] = await readPool.execute(
        `SELECT c.*, cc.name AS category_name, u.name AS faculty_advisor_name
         FROM clubs c
         JOIN club_categories cc ON cc.category_id      = c.category_id
         LEFT JOIN users       u  ON u.user_id          = c.faculty_advisor_id
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
        `SELECT c.*, cc.name AS category_name, u.name AS faculty_advisor_name
         FROM clubs c
         JOIN club_categories cc ON cc.category_id      = c.category_id
         LEFT JOIN users       u  ON u.user_id          = c.faculty_advisor_id
         WHERE c.club_id = ?`,
        [req.params.id],
      )
    );
    const [rows] = result;
    if (!rows.length) return next(notFound('Club not found.'));
    res.json({
      data: rows[0],
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/clubs
export async function createClub(req, res, next) {
  let conn;
  try {
    const {
      name, tagline = null, description = null,
      logo_url = null, website_url = null,
      category_id, faculty_advisor_id = null,
    } = req.body;

    const cleanDescription = sanitizeDescription(description);

    conn = await writePool.getConnection();
    const { result: clubId, executionTimeMs } = await timed(async () => {
      await conn.execute('SET @out_cid = 0');
      await conn.execute(
        `CALL sp_insert_club(:name, :tagline, :description, :logo_url, :website_url,
          :category_id, :faculty_advisor_id, @out_cid)`,
        {
          name, tagline, description: cleanDescription,
          logo_url, website_url, category_id,
          faculty_advisor_id,
        },
      );
      const [[{ out_cid }]] = await conn.execute('SELECT @out_cid AS out_cid');
      return out_cid;
    });

    const [[club]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    res.status(201).json({
      data: club,
      meta: { rowCount: 1, executionTimeMs },
    });
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
    const [[existing]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    if (!existing) return next(notFound('Club not found.'));

    const {
      name = existing.name,
      tagline = existing.tagline,
      description = existing.description,
      logo_url = existing.logo_url,
      website_url = existing.website_url,
      category_id = existing.category_id,
      faculty_advisor_id = existing.faculty_advisor_id,
      status = existing.status,
    } = req.body;

    const cleanDescription = sanitizeDescription(description);

    conn = await writePool.getConnection();
    const { executionTimeMs } = await timed(() =>
      conn.execute(
        `CALL sp_update_club(:club_id, :name, :tagline, :description, :logo_url, :website_url,
          :category_id, :faculty_advisor_id, :status, :updated_by)`,
        {
          club_id: clubId, name, tagline, description: cleanDescription,
          logo_url, website_url, category_id, faculty_advisor_id, status,
          updated_by: req.user.userId,
        },
      )
    );

    const [[club]] = await readPool.execute('SELECT * FROM clubs WHERE club_id = ?', [clubId]);
    res.json({
      data: club,
      meta: { rowCount: 1, executionTimeMs },
    });
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
    res.json({
      data: { deactivated: true },
      meta: { rowCount: 1, executionTimeMs },
    });
  } catch (err) {
    next(err);
  } finally {
    conn?.release();
  }
}
