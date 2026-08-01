import bcrypt from 'bcryptjs';

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_ANSWER_LENGTH = 2;

// پاسخ سوال امنیتی باید فارغ از فاصله، نوع ی/ک و ارقام فارسی مقایسه شود
export function normalizeAnswer(value) {
  return String(value ?? '')
    .replace(/[\u06F0-\u06F9]/g, (char) => String(char.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (char) => String(char.charCodeAt(0) - 0x0660))
    .replace(/[\u064A\u0649]/g, '\u06cc')
    .replace(/\u0643/g, '\u06a9')
    .replace(/[\u200b-\u200f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function hashSecret(value) {
  return bcrypt.hashSync(String(value), 10);
}

export function hashAnswer(value) {
  return bcrypt.hashSync(normalizeAnswer(value), 10);
}

export function verifyAnswer(value, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(normalizeAnswer(value), hash);
}
