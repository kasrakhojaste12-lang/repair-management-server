import express from 'express';
import { queryOne, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, notFound, toNumber } from '../utils/http.js';

const router = express.Router();

const COSTS_SELECT = `
  SELECT r.id AS repair_id, r.parts_cost, r.labor_cost, r.additional_cost, r.total_cost,
         r.payment_status, r.paid_at, r.status,
         c.full_name AS customer_name, d.device_type, d.brand, d.model
  FROM repairs r
  JOIN devices d ON d.id = r.device_id
  JOIN customers c ON c.id = d.customer_id`;

function readCost(value, label) {
  const amount = toNumber(value, Number.NaN);
  if (!Number.isFinite(amount)) throw badRequest(`${label} باید عدد باشد.`);
  if (amount < 0) throw badRequest(`${label} نمی‌تواند منفی باشد.`);
  return amount;
}

router.get(
  '/:repairId',
  asyncHandler(async (req, res) => {
    const costs = await queryOne(`${COSTS_SELECT} WHERE r.id = ?`, [req.params.repairId]);
    if (!costs) throw notFound('سفارش تعمیر موردنطر پیدا نشد.');
    res.json({ ...costs, costs });
  })
);

router.put(
  '/:repairId',
  asyncHandler(async (req, res) => {
    const partsCost = readCost(req.body?.parts_cost ?? 0, 'هزینه قطعات');
    const laborCost = readCost(req.body?.labor_cost ?? 0, 'دستمزد');
    const additionalCost = readCost(req.body?.additional_cost ?? 0, 'هزینه جانبی');
    const totalCost = partsCost + laborCost + additionalCost;

    const paymentStatus = req.body?.payment_status ?? 'unpaid';
    if (!['paid', 'unpaid'].includes(paymentStatus)) {
      throw badRequest('وضعیت پرداخت معتبر نیست.');
    }

    const repair = await queryOne('SELECT id FROM repairs WHERE id = ?', [req.params.repairId]);
    if (!repair) throw notFound('سفارش تعمیر موردنطر پیدا نشد.');

    await withTransaction(async (connection) => {
      // paid_at فقط بار اول که وضعیت پرداخت‌شده می‌شود ثبت می‌شود
      await connection.query(
        `UPDATE repairs
         SET parts_cost = ?, labor_cost = ?, additional_cost = ?, total_cost = ?, payment_status = ?,
             paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END
         WHERE id = ?`,
        [
          partsCost,
          laborCost,
          additionalCost,
          totalCost,
          paymentStatus,
          paymentStatus,
          req.params.repairId
        ]
      );
    });

    const costs = await queryOne(`${COSTS_SELECT} WHERE r.id = ?`, [req.params.repairId]);
    res.json({ ...costs, costs, message: 'هزینه‌های تعمیر ذخیره شد.' });
  })
);

export default router;
