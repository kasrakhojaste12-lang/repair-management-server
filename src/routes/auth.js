import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { queryOne } from '../db/pool.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, requireFields } from '../utils/http.js';

const router = express.Router();

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    created_at: row.created_at
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

export default router;
