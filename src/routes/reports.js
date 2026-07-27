import express from 'express';
import { query, queryOne } from '../db/pool.js';
import { asyncHandler } from '../utils/http.js';

const router = express.Router();

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const revenue = await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(paid_at) = CURDATE() THEN total_cost ELSE 0 END), 0) AS today_revenue,
         COALESCE(SUM(CASE WHEN YEAR(paid_at) = YEAR(CURDATE()) AND MONTH(paid_at) = MONTH(CURDATE())
                           THEN total_cost ELSE 0 END), 0) AS month_revenue,
         COALESCE(SUM(total_cost), 0) AS total_revenue
       FROM repairs
       WHERE payment_status = 'paid' AND paid_at IS NOT NULL`
    );

    const counts = await queryOne(
      `SELECT COUNT(*) AS total_repairs,
              SUM(payment_status = 'paid') AS paid_repairs,
              SUM(payment_status = 'unpaid') AS unpaid_repairs,
              SUM(status = 'delivered') AS delivered_repairs
       FROM repairs`
    );

    res.json({
      today_revenue: Number(revenue?.today_revenue) || 0,
      month_revenue: Number(revenue?.month_revenue) || 0,
      total_revenue: Number(revenue?.total_revenue) || 0,
      total_repairs: Number(counts?.total_repairs) || 0,
      paid_repairs: Number(counts?.paid_repairs) || 0,
      unpaid_repairs: Number(counts?.unpaid_repairs) || 0,
      delivered_repairs: Number(counts?.delivered_repairs) || 0
    });
  })
);

// درامد ۶ ماه اخیر — ماه‌های بی درامد هم با مقدار صفر برمی‌گردند
router.get(
  '/monthly-revenue',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, COALESCE(SUM(total_cost), 0) AS revenue
       FROM repairs
       WHERE payment_status = 'paid'
         AND paid_at IS NOT NULL
         AND paid_at >= DATE_FORMAT(CURDATE() - INTERVAL 5 MONTH, '%Y-%m-01')
       GROUP BY month
       ORDER BY month ASC`
    );

    const byMonth = new Map(rows.map((row) => [row.month, Number(row.revenue) || 0]));
    const months = [];
    const now = new Date();
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, revenue: byMonth.get(key) ?? 0 });
    }

    res.json(months);
  })
);

router.get(
  '/device-type-revenue',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT d.device_type,
              COALESCE(SUM(CASE WHEN r.payment_status = 'paid' THEN r.total_cost ELSE 0 END), 0) AS revenue,
              COUNT(*) AS repair_count
       FROM repairs r
       JOIN devices d ON d.id = r.device_id
       GROUP BY d.device_type
       ORDER BY revenue DESC`
    );

    res.json(
      rows.map((row) => ({
        device_type: row.device_type,
        revenue: Number(row.revenue) || 0,
        repair_count: Number(row.repair_count) || 0
      }))
    );
  })
);

export default router;
