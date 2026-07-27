// ساخت دیتابیس و جداول و داده‌های نمونه
// اجرا: npm run db:init
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

async function readSqlFile(name) {
  return readFile(path.join(currentDir, name), 'utf8');
}

async function tableCount(connection, table) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  return Number(rows[0]?.total) || 0;
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

    if ((await tableCount(connection, 'users')) === 0) {
      const adminHash = bcrypt.hashSync('admin123', 10);
      const employeeHash = bcrypt.hashSync('employee123', 10);
      await connection.query(
        'INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`) VALUES (1, ?, ?, ?, ?), (2, ?, ?, ?, ?)',
        [
          'admin',
          adminHash,
          'مدیر سیستم',
          'admin',
          'employee',
          employeeHash,
          'کارمند پذیرش',
          'employee'
        ]
      );
      console.log('✔ کاربران پیش‌فرض ساخته شدند (admin/admin123 و employee/employee123)');
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
