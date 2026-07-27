export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message) {
  return new HttpError(400, message);
}

export function notFound(message = 'مورد موردنطر پیدا نشد.') {
  return new HttpError(404, message);
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawLimit = Number.parseInt(query.limit, 10) || 10;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

export function searchTerm(query = {}) {
  const value = typeof query.search === 'string' ? query.search.trim() : '';
  return value ? `%${value}%` : '';
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length) {
    throw badRequest(`پر کردن این فیلدها الزامی است: ${missing.join(', ')}`);
  }
}
