// مهاجرت‌های ساده و ایمن (قابل اجرای چندباره)
// برای دیتابیس‌هایی که قبلاً ساخته شده‌اند و ستون‌های جدید را ندارند.
import { config } from '../config/env.js';
import { execute, query } from './pool.js';

async function hasColumn(table, column) {
  const rows = await query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.database, table, column]
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition) {
  if (await hasColumn(table, column)) return false;
  await execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

export async function runMigrations({ silent = false } = {}) {
  const applied = [];

  if (await addColumn('users', 'security_question', 'VARCHAR(255) NULL AFTER `role`')) {
    applied.push('users.security_question');
  }
  if (
    await addColumn(
      'users',
      'security_answer_hash',
      'VARCHAR(255) NULL AFTER `security_question`'
    )
  ) {
    applied.push('users.security_answer_hash');
  }

  if (!silent && applied.length) {
    console.log(`✔ مهاجرت دیتابیس انجام شد: ${applied.join('، ')}`);
  }

  return applied;
}
