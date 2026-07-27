import express from 'express';
import { execute, query, queryOne } from '../db/pool.js';
import { asyncHandler, getPagination, notFound, requireFields, searchTerm } from '../utils/http.js';

const router = express.Router();

const CUSTOMER_COLUMNS = 'id, full_name, phone, email, address, created_at, updated_at';

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const term = searchTerm(req.query);
    const where = term ? 'WHERE full_name LIKE ? OR phone LIKE ? OR email LIKE ?' : '';
    const whereParams = term ? [term, term, term] : [];

    const data = await query(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );
    const totals = await queryOne(`SELECT COUNT(*) AS total FROM customers ${where}`, whereParams);

    res.json({ data, pagination: { page, limit, total: Number(totals?.total) || 0 } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await queryOne(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?`, [
      req.params.id
    ]);
    if (!customer) throw notFound('مشتری موردنطر پیدا نشد.');

    const devices = await query(
      `SELECT d.id, d.device_type, d.brand, d.model, d.serial_number, d.issue_description,
              d.received_date, d.expected_delivery_date,
              r.id AS repair_id, r.status, r.payment_status, r.total_cost
       FROM devices d
       LEFT JOIN repairs r ON r.device_id = d.id
       WHERE d.customer_id = ?
       ORDER BY d.id DESC`,
      [req.params.id]
    );

    res.json({ customer, devices });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['full_name', 'phone']);
    const { full_name, phone, email, address } = req.body;

    const result = await execute(
      'INSERT INTO customers (full_name, phone, email, address) VALUES (?, ?, ?, ?)',
      [String(full_name).trim(), String(phone).trim(), email || null, address || null]
    );
    const customer = await queryOne(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?`, [
      result.insertId
    ]);

    res.status(201).json({ customer, message: 'مشتری جدید ثبت شد.' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['full_name', 'phone']);
    const { full_name, phone, email, address } = req.body;

    const result = await execute(
      'UPDATE customers SET full_name = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [String(full_name).trim(), String(phone).trim(), email || null, address || null, req.params.id]
    );
    if (!result.affectedRows) throw notFound('مشتری موردنطر پیدا نشد.');

    const customer = await queryOne(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?`, [
      req.params.id
    ]);
    res.json({ customer, message: 'اطلاعات مشتری ویرایش شد.' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await execute('DELETE FROM customers WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) throw notFound('مشتری موردنطر پیدا نشد.');
    res.json({ message: 'مشتری و دستگاه‌های مربوط به ان حذف شدند.' });
  })
);

export default router;
