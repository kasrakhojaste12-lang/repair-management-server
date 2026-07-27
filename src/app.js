import cors from 'cors';
import express from 'express';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // درخواست‌های بدون origin (مانند curl یا Postman) ازاد هستند
        if (!origin || config.clientOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`درخواست از ادرس ${origin} اجازه دسترسی ندارد.`));
      },
      credentials: true
    })
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/', (req, res) => {
    res.json({
      name: 'repair-management-server',
      message: 'سرور سیستم مدیریت تعمیرات در حال اجرا است.',
      api: '/api'
    });
  });

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
