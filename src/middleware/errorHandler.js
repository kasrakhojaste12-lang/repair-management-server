import { HttpError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `مسیر ${req.method} ${req.originalUrl} در این سرور وجود ندارد.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  // خطاهای رایج MySQL را به پیام فارسی قابل فهم تبدیل می‌کنیم
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'این مقدار تکراری است و قبلاً ثبت شده است.' });
  }
  if (error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ message: 'مورد انتخاب‌شده در دیتابیس وجود ندارد.' });
  }
  if (error?.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      message: 'جداول دیتابیس ساخته نشده‌اند. دستور npm run db:init را اجرا کنید.'
    });
  }
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({
      message: 'اتصال به MySQL برقرار نشد. از روشن بودن دیتابیس و درستی فایل .env مطمئن شوید.'
    });
  }

  console.error('خطای پیش‌بینی‌نشده در سرور:', error);
  return res.status(500).json({ message: 'خطای داخلی سرور. لطفاً دوباره تلاش کنید.' });
}
