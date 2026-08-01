import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { execute, queryOne } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, badRequest, HttpError, requireFields } from '../utils/http.js';
import {
  hashAnswer,
  hashSecret,
  MIN_ANSWER_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyAnswer
} from '../utils/security.js';

const router = express.Router();

// جلوگیری از حدس زدن پشت‌سر‌هم پاسخ سوال امنیتی
const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const resetAttempts = new Map();

function attemptKey(req, username) {
  return `${req.ip || 'local'}|${username}`;
}

function assertNotBlocked(key) {
  const entry = resetAttempts.get(key);
  if (!entry) return;
  if (Date.now() - entry.firstAt > RESET_WINDOW_MS) {
    resetAttempts.delete(key);
    return;
  }
  if (entry.count >= RESET_MAX_ATTEMPTS) {
    throw new HttpError(
      429,
      'تعداد تلاش‌های ناموفق زیاد است. ۱۵ دقیقه دیگر دوباره تلاش کنید.'
    );
  }
}

function registerFailure(key) {
  const entry = resetAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > RESET_WINDOW_MS) {
    resetAttempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    created_at: row.created_at,
    security_question: row.security_question || null,
    has_security_question: Boolean(row.security_answer_hash)
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['username', 'password']);
    const username = String(req.body.username).trim();
    const password = String(req.body.password);

    const user = await queryOne('SELECT * FROM users WHERE username = ?', [username]);
    const passwordMatches = user ? bcrypt.compareSync(password, user.password_hash) : false;

    // پیام یکسان برای نام کاربری و رمز غلط، تا اطلاعات لو نرود
    if (!user || !passwordMatches) {
      return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    return res.json({ token, user: publicUser(user) });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

// گام ۱ بازیابی: گرفتن سوال امنیتی کاربر
router.get(
  '/security-question',
  asyncHandler(async (req, res) => {
    const username = String(req.query.username ?? '').trim();
    if (!username) throw badRequest('نام کاربری را وارد کنید.');

    const key = attemptKey(req, username);
    assertNotBlocked(key);

    const user = await queryOne(
      'SELECT username, security_question, security_answer_hash FROM users WHERE username = ?',
      [username]
    );

    if (!user || !user.security_answer_hash) {
      registerFailure(key);
      // پیام یکسان، تا وجود/عدم وجود کاربر لو نرود
      throw new HttpError(
        404,
        'برای این نام کاربری سوال امنیتی ثبت نشده است. از مدیر سیستم بخواهید رمز شما را تغییر دهد.'
      );
    }

    res.json({ username: user.username, security_question: user.security_question });
  })
);

// گام ۲ بازیابی: پاسخ سوال امنیتی + رمز جدید
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['username', 'security_answer', 'new_password']);
    const username = String(req.body.username).trim();
    const answer = String(req.body.security_answer);
    const newPassword = String(req.body.new_password);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`);
    }

    const key = attemptKey(req, username);
    assertNotBlocked(key);

    const user = await queryOne(
      'SELECT id, username, security_answer_hash FROM users WHERE username = ?',
      [username]
    );

    if (!user || !verifyAnswer(answer, user.security_answer_hash)) {
      registerFailure(key);
      throw new HttpError(400, 'پاسخ سوال امنیتی درست نیست.');
    }

    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      hashSecret(newPassword),
      user.id
    ]);
    resetAttempts.delete(key);

    res.json({ message: 'رمز عبور با موفقیت تغییر کرد. حالا می‌توانید وارد شوید.' });
  })
);

// ثبت/تغییر سوال امنیتی توسط خود کاربر (با تایید رمز فعلی)
router.put(
  '/security-question',
  authenticate,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['current_password', 'security_question', 'security_answer']);
    const currentPassword = String(req.body.current_password);
    const question = String(req.body.security_question).trim();
    const answer = String(req.body.security_answer);

    if (!bcrypt.compareSync(currentPassword, req.user.password_hash)) {
      throw badRequest('رمز عبور فعلی درست نیست.');
    }
    if (question.length < 5) throw badRequest('متن سوال امنیتی خیلی کوتاه است.');
    if (answer.trim().length < MIN_ANSWER_LENGTH) {
      throw badRequest(`پاسخ سوال امنیتی باید حداقل ${MIN_ANSWER_LENGTH} کاراکتر باشد.`);
    }

    await execute(
      'UPDATE users SET security_question = ?, security_answer_hash = ? WHERE id = ?',
      [question, hashAnswer(answer), req.user.id]
    );

    res.json({ message: 'سوال امنیتی ذخیره شد.' });
  })
);

export default router;
