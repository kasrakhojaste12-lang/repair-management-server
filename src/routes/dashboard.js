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
                           THEN total_cost ELSE 0 END), 0) AS month_revenue
       FROM repairs
       WHERE payment_status = 'paid' AND paid_at IS NOT NULL`
    );

    const counts = await queryOne(
      `SELECT
         COUNT(*) AS total_repairs,
         SUM(status = 'completed') AS completed_repairs,
         SUM(status = 'delivered') AS delivered_repairs,
         SUM(status NOT IN ('completed', 'delivered')) AS active_repairs,
         SUM(payment_status = 'paid') AS paid_repairs,
         SUM(payment_status = 'unpaid') AS unpaid_repairs
       FROM repairs`
    );

    const customers = await queryOne('SELECT COUNT(*) AS total_customers FROM customers');

    const recentRepairs = await query(
      `SELECT r.id, r.status, r.payment_status, r.total_cost, r.updated_at,
              c.full_name AS customer_name, d.device_type, d.brand, d.model,
              d.received_date, d.expected_delivery_date
       FROM repairs r
       JOIN devices d ON d.id = r.device_id
       JOIN customers c ON c.id = d.customer_id
       ORDER BY r.updated_at DESC, r.id DESC
       LIMIT 5`
    );

    res.json({
      today_revenue: Number(revenue?.today_revenue) || 0,
      month_revenue: Number(revenue?.month_revenue) || 0,
      total_customers: Number(customers?.total_customers) || 0,
      total_repairs: Number(counts?.total_repairs) || 0,
      active_repairs: Number(counts?.active_repairs) || 0,
      completed_repairs: Number(counts?.completed_repairs) || 0,
      delivered_repairs: Number(counts?.delivered_repairs) || 0,
      paid_repairs: Number(counts?.paid_repairs) || 0,
      unpaid_repairs: Number(counts?.unpaid_repairs) || 0,
      recent_repairs: recentRepairs
    });
  })
);

export default router;
