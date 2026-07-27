import 'dotenv/config';

function parseOrigins(value) {
  if (!value) return ['http://localhost:5173'];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number.parseInt(process.env.PORT, 10) || 5000,
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'repair_management'
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h'
};
