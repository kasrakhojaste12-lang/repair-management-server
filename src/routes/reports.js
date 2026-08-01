import { Router } from 'express';
import { query, queryOne } from '../db/pool.js';
import { asyncHandler, badRequest } from '../utils/http.js';
import {
  addJalaliMonths,
  currentJalaliMonth,
  gregorianToJalali,
  jalaliMonthKey,
  jalaliMonthLabel,
  jalaliMonthRange,
  parseDateParts
} from '../utils/jalali.js';

const router = Router();

const PAID_FILTER = "payment_status = 'paid' AND paid_at IS NOT NULL";

// جمع درامد روزانه — پایه‌ی دسته‌بندی ماه شمسی در جاوااسکریپت
async function dailyPaidTotals() {
  return query(
    `SELECT DATE(paid_at) AS day,
            COALESCE(SUM(total_cost), 0) AS revenue,
            COUNT(*) AS repair_count
       FROM repairs
      WHERE ${PAID_FILTER}
      GROUP BY DATE(paid_at)
      ORDER BY day ASC`
  );
}

function bucketByJalaliMonth(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const parts = parseDateParts(row.day);
    if (!parts) continue;
    const { jy, jm } = gregorianToJalali(parts.gy, parts.gm, parts.gd);
    const key = jalaliMonthKey(jy, jm);
    const current = buckets.get(key) || { year: jy, month: jm, revenue: 0, repair_count: 0 };
    current.revenue += Number(row.revenue || 0);
    current.repair_count += Number(row.repair_count || 0);
    buckets.set(key, current);
  }
  return buckets;
}

function parseMonthParams(reqQuery) {
  const year = Number(reqQuery.year);
  const month = Number(reqQuery.month);
  if (!Number.isInteger(year) || year < 1300 || year > 1500) {
    throw badRequest('سال شمسی معتبر نیست.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw badRequest('ماه باید عددی بین ۱ تا ۱۲ باشد.');
  }
  return { year, month };
}

// خلاصه‌ی کلی
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const summary = await queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN ${PAID_FILTER} AND DATE(paid_at) = CURDATE() THEN total_cost END), 0) AS today_revenue,
         COALESCE(SUM(CASE WHEN ${PAID_FILTER} AND YEAR(paid_at) = YEAR(CURDATE()) AND MONTH(paid_at) = MONTH(CURDATE()) THEN total_cost END), 0) AS month_revenue,
         COALESCE(SUM(CASE WHEN ${PAID_FILTER} THEN total_cost END), 0) AS total_revenue,
         COUNT(*) AS total_repairs,
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_repairs,
         COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END), 0) AS unpaid_repairs,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_repairs
       FROM repairs`
    );

    res.json(summary);
  })
);

// درامد ۶ ماه اخیر (شمسی)
router.get(
  '/monthly-revenue',
  asyncHandler(async (_req, res) => {
    const buckets = bucketByJalaliMonth(await dailyPaidTotals());
    const now = currentJalaliMonth();
    const result = [];

    for (let offset = -5; offset <= 0; offset += 1) {
      const { year, month } = addJalaliMonths(now.year, now.month, offset);
      const key = jalaliMonthKey(year, month);
      const bucket = buckets.get(key);
      result.push({
        month: key,
        year,
        month_number: month,
        label: jalaliMonthLabel(year, month),
        revenue: bucket ? bucket.revenue : 0,
        repair_count: bucket ? bucket.repair_count : 0
      });
    }

    res.json(result);
  })
);

// فهرست سال‌ها و همه‌ی ماه‌های هر سال برای لیست‌باکس گزارش‌ها
router.get(
  '/months',
  asyncHandler(async (_req, res) => {
    const buckets = bucketByJalaliMonth(await dailyPaidTotals());
    const now = currentJalaliMonth();

    const years = new Set([now.year]);
    for (const bucket of buckets.values()) years.add(bucket.year);

    const sortedYears = [...years].sort((a, b) => b - a);
    const months = [];

    for (const year of sortedYears) {
      for (let month = 1; month <= 12; month += 1) {
        const key = jalaliMonthKey(year, month);
        const bucket = buckets.get(key);
        months.push({
          key,
          year,
          month,
          label: jalaliMonthLabel(year, month),
          revenue: bucket ? bucket.revenue : 0,
          repair_count: bucket ? bucket.repair_count : 0
        });
      }
    }

    res.json({ years: sortedYears, current: now, months });
  })
);

// جزییات درامد یک ماه شمسی خاص
router.get(
  '/monthly-detail',
  asyncHandler(async (req, res) => {
    const { year, month } = parseMonthParams(req.query);
    const { start, endExclusive } = jalaliMonthRange(year, month);
    const range = [start, endExclusive];

    const totals = await queryOne(
      `SELECT COALESCE(SUM(total_cost), 0) AS revenue,
              COUNT(*) AS paid_repairs,
              COALESCE(AVG(total_cost), 0) AS average_revenue,
              COALESCE(MAX(total_cost), 0) AS max_invoice
         FROM repairs
        WHERE ${PAID_FILTER} AND DATE(paid_at) >= ? AND DATE(paid_at) < ?`,
      range
    );

    const registered = await queryOne(
      `SELECT COUNT(*) AS created_repairs
         FROM repairs
        WHERE DATE(created_at) >= ? AND DATE(created_at) < ?`,
      range
    );

    const unpaid = await queryOne(
      `SELECT COALESCE(SUM(total_cost), 0) AS unpaid_amount,
              COUNT(*) AS unpaid_repairs
         FROM repairs
        WHERE payment_status = 'unpaid' AND DATE(created_at) >= ? AND DATE(created_at) < ?`,
      range
    );

    const deviceBreakdown = await query(
      `SELECT d.device_type,
              COALESCE(SUM(r.total_cost), 0) AS revenue,
              COUNT(*) AS repair_count
         FROM repairs r
         JOIN devices d ON d.id = r.device_id
        WHERE r.payment_status = 'paid' AND r.paid_at IS NOT NULL
          AND DATE(r.paid_at) >= ? AND DATE(r.paid_at) < ?
        GROUP BY d.device_type
        ORDER BY revenue DESC`,
      range
    );

    const repairs = await query(
      `SELECT r.id AS repair_id,
              r.total_cost,
              r.status,
              r.paid_at,
              c.full_name,
              c.phone,
              d.device_type,
              d.brand,
              d.model
         FROM repairs r
         JOIN devices d ON d.id = r.device_id
         JOIN customers c ON c.id = d.customer_id
        WHERE r.payment_status = 'paid' AND r.paid_at IS NOT NULL
          AND DATE(r.paid_at) >= ? AND DATE(r.paid_at) < ?
        ORDER BY r.paid_at ASC, r.id ASC`,
      range
    );

    res.json({
      year,
      month,
      key: jalaliMonthKey(year, month),
      label: jalaliMonthLabel(year, month),
      range: { start, end_exclusive: endExclusive },
      revenue: Number(totals.revenue || 0),
      paid_repairs: Number(totals.paid_repairs || 0),
      average_revenue: Number(totals.average_revenue || 0),
      max_invoice: Number(totals.max_invoice || 0),
      created_repairs: Number(registered.created_repairs || 0),
      unpaid_amount: Number(unpaid.unpaid_amount || 0),
      unpaid_repairs: Number(unpaid.unpaid_repairs || 0),
      device_breakdown: deviceBreakdown.map((row) => ({
        device_type: row.device_type,
        revenue: Number(row.revenue || 0),
        repair_count: Number(row.repair_count || 0)
      })),
      repairs
    });
  })
);

// درامد بر اساس نوع دستگاه
router.get(
  '/device-type-revenue',
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT d.device_type,
              COALESCE(SUM(CASE WHEN r.payment_status = 'paid' THEN r.total_cost END), 0) AS revenue,
              COUNT(*) AS repair_count
         FROM devices d
         JOIN repairs r ON r.device_id = d.id
        GROUP BY d.device_type
        ORDER BY revenue DESC`
    );

    res.json(
      rows.map((row) => ({
        device_type: row.device_type,
        revenue: Number(row.revenue || 0),
        repair_count: Number(row.repair_count || 0)
      }))
    );
  })
);

export default router;
