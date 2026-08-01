// ساخت دیتابیس و جداول و داده‌های نمونه
// اجرا: npm run db:init
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';
import { hashAnswer } from '../utils/security.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

async function readSqlFile(name) {
  return readFile(path.join(currentDir, name), 'utf8');
}

async function tableCount(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0]?.total) || 0;
}

async function hasColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.database, table, column]
  );
  return rows.length > 0;
}

// برای دیتابیس‌های قدیمی که ستون‌های سوال امنیتی را ندارند
async function migrate(connection) {
  const applied = [];
  if (!(await hasColumn(connection, 'users', 'security_question'))) {
    await connection.query(
      'ALTER TABLE `users` ADD COLUMN `security_question` VARCHAR(255) NULL AFTER `role`'
    );
    applied.push('security_question');
  }
  if (!(await hasColumn(connection, 'users', 'security_answer_hash'))) {
    await connection.query(
      'ALTER TABLE `users` ADD COLUMN `security_answer_hash` VARCHAR(255) NULL AFTER `security_question`'
    );
    applied.push('security_answer_hash');
  }
  if (applied.length) {
    console.log(`✔ ستون‌های جدید به جدول کاربران اضافه شد: ${applied.join('، ')}`);
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci'
  });

  try {
    const schema = await readSqlFile('schema.sql');
    const schemaSql = schema.replaceAll('`repair_management`', `\`${config.db.database}\``);
    await connection.query(schemaSql);
    await connection.changeUser({ database: config.db.database });
    console.log(`✔ دیتابیس و جداول اماده شد: ${config.db.database}`);

    await migrate(connection);

    if ((await tableCount(connection, 'users')) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const employeeHash = bcrypt.hashSync('employee123', 10);
      const question = 'نام شهر محل تولد شما چیست؟';
      await connection.query(
        `INSERT INTO \`users\`
           (\`id\`, \`username\`, \`password_hash\`, \`full_name\`, \`role\`, \`security_question\`, \`security_answer_hash\`)
         VALUES (1, ?, ?, ?, ?, ?, ?), (2, ?, ?, ?, ?, ?, ?)`,
        [
          'admin',
          adminHash,
          'مدیر سیستم',
          'admin',
          question,
          hashAnswer('تهران'),
          'employee',
          employeeHash,
          'کارمند پذیرش',
          'employee',
          question,
          hashAnswer('شیراز')
        ]
      );
      console.log('✔ کاربران پیش‌فرض ساخته شدند (admin/admin123 و employee/employee123)');
      console.log('  • سوال امنیتی هر دو: «نام شهر محل تولد شما چیست؟» — پاسخ admin: تهران ، پاسخ employee: شیراز');
    } else {
      console.log('• جدول کاربران خالی نبود؛ ایجاد کاربر پیش‌فرض رد شد.');
    }

    if ((await tableCount(connection, 'customers')) === 0) {
      const seed = await readSqlFile('seed.sql');
      await connection.query(seed);
      console.log('✔ داده‌های نمونه (۵ مشتری، ۶ دستگاه، ۶ سفارش تعمیر) وارد شد.');
    } else {
      console.log('• دیتابیس از قبل داده داشت؛ داده‌ نمونه وارد نشد.');
    }

    console.log('\nهمه چیز اماده است. حالا دستور npm run dev را اجرا کنید.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  if (error?.code === 'ECONNREFUSED') {
    console.error('✖ اتصال به MySQL برقرار نشد. اگر XAMPP دارید، از کنترل‌پنل ان مطمئن شوید MySQL روشن است.');
  } else if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('✖ نام کاربری یا رمز MySQL در فایل .env درست نیست.');
  } else {
    console.error('✖ خطا در اماده‌سازی دیتابیس:', error.message);
  }
  process.exit(1);
});
