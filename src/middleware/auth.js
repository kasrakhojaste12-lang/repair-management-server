import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { queryOne } from '../db/pool.js';

function readToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function authenticate(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: 'برای دسترسی به این بخش باید وارد شوید.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await queryOne(
      `SELECT id, username, full_name, role, created_at, password_hash,
              security_question, security_answer_hash
         FROM users WHERE id = ?`,
      [payload.sub]
    );
    if (!user) {
      return res.status(401).json({ message: 'کاربر این نشست دیگر وجود ندارد.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'نشست شما منقضی شده است. دوباره وارد شوید.' });
    }
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'این بخش فقط برای مدیر سیستم در دسترس است.' });
  }
  return next();
}
