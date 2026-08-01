import { createApp } from './app.js';
import { config } from './config/env.js';
import { assertConnection } from './db/pool.js';
import { runMigrations } from './db/migrations.js';

async function start() {
  try {
    await assertConnection();
    console.log(`✔ اتصال به MySQL برقرار شد (${config.db.host}:${config.db.port}/${config.db.database})`);
    await runMigrations();
  } catch (error) {
    if (error?.code === 'ECONNREFUSED') {
      console.error('✖ MySQL در دسترس نیست. اگر XAMPP دارید، از کنترل‌پنل ان MySQL را Start کنید.');
    } else if (error?.code === 'ER_BAD_DB_ERROR') {
      console.error('✖ دیتابیس ساخته نشده است. اول دستور npm run db:init را اجرا کنید.');
    } else if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('✖ نام کاربری یا رمز MySQL در فایل .env درست نیست.');
    } else {
      console.error('✖ خطا در اتصال به دیتابیس:', error.message);
    }
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`✔ سرور روی http://localhost:${config.port}/api اجرا شد`);
    console.log(`✔ درخواست از این ادرس‌ها مجاز است: ${config.clientOrigins.join(', ')}`);
  });
}

start();
