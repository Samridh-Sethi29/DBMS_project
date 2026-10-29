// src/config/db.js
// Two connection pools: readPool (role_naive) and writePool (role_developer).
// namedPlaceholders: true allows :name syntax in queries.

import mysql from 'mysql2/promise';
import 'dotenv/config';

const shared = {
  host            : process.env.DB_HOST     || 'localhost',
  port            : Number(process.env.DB_PORT) || 3306,
  database        : process.env.DB_NAME     || 'club_event_db',
  connectionLimit : 10,
  namedPlaceholders: true,
  waitForConnections: true,
  queueLimit      : 0,
  timezone        : '+00:00',
};

/** Read-only pool – uses role_naive credentials */
export const readPool = mysql.createPool({
  ...shared,
  user    : process.env.DB_READ_USER || 'user_naive',
  password: process.env.DB_READ_PASS,
});

/** Write pool – uses role_developer credentials */
export const writePool = mysql.createPool({
  ...shared,
  user    : process.env.DB_WRITE_USER || 'user_developer',
  password: process.env.DB_WRITE_PASS,
});

/** Convenience: run a single query on the read pool */
export async function rq(sql, params) {
  const [rows] = await readPool.execute(sql, params);
  return rows;
}

/** Convenience: run a single query on the write pool */
export async function wq(sql, params) {
  const [rows] = await writePool.execute(sql, params);
  return rows;
}

/** Get a transactional connection from the write pool.
 *  Always call conn.release() in a finally block. */
export async function getWriteConn() {
  return writePool.getConnection();
}
