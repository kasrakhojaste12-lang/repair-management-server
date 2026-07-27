import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

// dateStrings: true باعث می‌شود تاریخ‌ها به شکل 'YYYY-MM-DD' برگردند
// تا تبدیل به UTC در مرورگر تاریخ را یک روز جابجا نکند.
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
  charset: 'utf8mb4_unicode_ci'
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

export async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assertConnection() {
  const connection = await pool.getConnection();
  connection.release();
}
