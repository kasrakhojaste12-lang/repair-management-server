import bcrypt from 'bcryptjs';
import express from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { asyncHandler, badRequest, getPagination, notFound, requireFields, searchTerm } from '../utils/http.js';

const router = express.Router();

const USER_COLUMNS = 'id, username, full_name, role, created_at';
const MIN_PASSWORD_LENGTH = 6;
const ROLES = ['admin', 'employee'];

function assertRole(role) {
  if (!ROLES.includes(role)) throw badRequest('نقش کاربر معتبر نیست.');
}

function assertPassword(password) {
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.`);
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const term = searchTerm(req.query);
    const where = term ? 'WHERE username LIKE ? OR full_name LIKE ?' : '';
    const whereParams = term ? [term, term] : [];

    const data = await query(
      `SELECT ${USER_COLUMNS} FROM users ${where} ORDER BY id ASC LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );
    const totals = await queryOne(`SELECT COUNT(*) AS total FROM users ${where}`, whereParams);

    res.json({ data, pagination: { page, limit, total: Number(totals?.total) || 0 } });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['username', 'password', 'full_name', 'role']);
    const { username, password, full_name, role } = req.body;
    assertRole(role);
    assertPassword(password);

    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [
      String(username).trim()
    ]);
    if (existing) throw badRequest('این نام کاربری قبلاً ثبت شده است.');

    const result = await execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [String(username).trim(), bcrypt.hashSync(String(password), 10), String(full_name).trim(), role]
    );
    const user = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [result.insertId]);

    res.status(201).json({ user, message: 'کاربر جدید ساخته شد.' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['full_name', 'role']);
    const { full_name, role, password } = req.body;
    assertRole(role);

    const target = await queryOne('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!target) throw notFound('کاربر موردنطر پیدا نشد.');

    // مدیر نباید نقش خودش را پایین بیاورد و سیستم بی‌مدیر بماند
    if (Number(req.params.id) === Number(req.user.id) && role !== 'admin') {
      throw badRequest('نمی‌توانید نقش مدیریت حساب خودتان را حذف کنید.');
    }

    if (password !== undefined && String(password).trim() !== '') {
      assertPassword(password);
      await execute('UPDATE users SET password_hash = ? WHERE id = ?', [
        bcrypt.hashSync(String(password), 10),
        req.params.id
      ]);
    }

    await execute('UPDATE users SET full_name = ?, role = ? WHERE id = ?', [
      String(full_name).trim(),
      role,
      req.params.id
    ]);

    const user = await queryOne(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.params.id]);
    res.json({ user, message: 'اطلاعات کاربر ویرایش شد.' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (Number(req.params.id) === Number(req.user.id)) {
      throw badRequest('حساب کاربری خودتان را نمی‌توانید حذف کنید.');
    }

    const admins = await queryOne("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    const target = await queryOne('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!target) throw notFound('کاربر موردنطر پیدا نشد.');

    if (target.role === 'admin' && Number(admins?.total) <= 1) {
      throw badRequest('حداقل یک مدیر باید در سیستم باقی بماند.');
    }

    await execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'کاربر حذف شد.' });
  })
);

export default router;
