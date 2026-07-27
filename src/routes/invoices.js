import express from 'express';
import { queryOne } from '../db/pool.js';
import { asyncHandler, notFound } from '../utils/http.js';

const router = express.Router();

router.get(
  '/:repairId',
  asyncHandler(async (req, res) => {
    const invoice = await queryOne(
      `SELECT r.id AS repair_id,
              c.id AS customer_id, c.full_name, c.phone, c.email, c.address,
              d.id AS device_id, d.device_type, d.brand, d.model, d.serial_number,
              d.issue_description, d.received_date, d.expected_delivery_date,
              r.status, r.payment_status, r.technician_notes,
              r.parts_cost, r.labor_cost, r.additional_cost, r.total_cost,
              -- تاریخ صدور فاکتور = زمان ثبت سفارش تعمیر
              r.created_at AS invoice_date,
              r.created_at, r.updated_at, r.paid_at, r.delivered_at
       FROM repairs r
       JOIN devices d ON d.id = r.device_id
       JOIN customers c ON c.id = d.customer_id
       WHERE r.id = ?`,
      [req.params.repairId]
    );

    if (!invoice) throw notFound('فاکتور موردنطر پیدا نشد.');
    res.json(invoice);
  })
);

export default router;
