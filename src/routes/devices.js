import express from 'express';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, getPagination, notFound, requireFields, searchTerm } from '../utils/http.js';

const router = express.Router();

const DEVICE_TYPES = ['mobile', 'laptop', 'desktop', 'tablet'];

const DEVICE_SELECT = `
  SELECT d.id, d.customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
         d.device_type, d.brand, d.model, d.serial_number, d.issue_description,
         d.received_date, d.expected_delivery_date, d.created_at,
         r.id AS repair_id, r.status, r.payment_status, r.technician_notes,
         r.parts_cost, r.labor_cost, r.additional_cost, r.total_cost
  FROM devices d
  JOIN customers c ON c.id = d.customer_id
  LEFT JOIN repairs r ON r.device_id = d.id`;

function assertDeviceType(value) {
  if (!DEVICE_TYPES.includes(value)) {
    throw badRequest('نوع دستگاه معتبر نیست.');
  }
}

function normalizeDate(value, fieldLabel, { required = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw badRequest(`${fieldLabel} الزامی است.`);
    return null;
  }
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw badRequest(`${fieldLabel} باید به قالب YYYY-MM-DD باشد.`);
  }
  return text;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const term = searchTerm(req.query);
    const where = term
      ? 'WHERE c.full_name LIKE ? OR d.brand LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?'
      : '';
    const whereParams = term ? [term, term, term, term] : [];

    const data = await query(`${DEVICE_SELECT} ${where} ORDER BY d.id DESC LIMIT ? OFFSET ?`, [
      ...whereParams,
      limit,
      offset
    ]);
    const totals = await queryOne(
      `SELECT COUNT(*) AS total FROM devices d JOIN customers c ON c.id = d.customer_id ${where}`,
      whereParams
    );

    res.json({ data, pagination: { page, limit, total: Number(totals?.total) || 0 } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const device = await queryOne(`${DEVICE_SELECT} WHERE d.id = ?`, [req.params.id]);
    if (!device) throw notFound('دستگاه موردنطر پیدا نشد.');
    res.json({ device });
  })
);

router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const device = await queryOne(`${DEVICE_SELECT} WHERE d.id = ?`, [req.params.id]);
    if (!device) throw notFound('دستگاه موردنطر پیدا نشد.');

    const history = device.repair_id
      ? await query(
          `SELECT h.id, h.status, h.notes, h.created_at, u.full_name AS changed_by_name
           FROM repair_status_history h
           LEFT JOIN users u ON u.id = h.changed_by
           WHERE h.repair_id = ?
           ORDER BY h.created_at ASC, h.id ASC`,
          [device.repair_id]
        )
      : [];

    res.json({ device, history });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['customer_id', 'device_type', 'brand', 'model', 'issue_description']);
    const {
      customer_id,
      device_type,
      brand,
      model,
      serial_number,
      issue_description,
      received_date,
      expected_delivery_date,
      technician_notes
    } = req.body;

    assertDeviceType(device_type);
    const receivedDate = normalizeDate(received_date, 'تاریخ دریافت', { required: true });
    const expectedDate = normalizeDate(expected_delivery_date, 'تاریخ تحویل مورد انتطار');

    const customer = await queryOne('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (!customer) throw badRequest('مشتری انتخاب‌شده وجود ندارد.');

    // ثبت دستگاه + سفارش تعمیر + اولین رکورد خط زمانی در یک تراکنش
    const deviceId = await withTransaction(async (connection) => {
      const [deviceResult] = await connection.query(
        `INSERT INTO devices
           (customer_id, device_type, brand, model, serial_number, issue_description, received_date, expected_delivery_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customer_id,
          device_type,
          String(brand).trim(),
          String(model).trim(),
          serial_number || null,
          String(issue_description).trim(),
          receivedDate,
          expectedDate
        ]
      );

      const [repairResult] = await connection.query(
        'INSERT INTO repairs (device_id, status, technician_notes) VALUES (?, ?, ?)',
        [deviceResult.insertId, 'received', technician_notes || null]
      );

      await connection.query(
        'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
        [repairResult.insertId, 'received', 'دستگاه در پذیرش ثبت شد.', req.user.id]
      );

      return deviceResult.insertId;
    });

    const device = await queryOne(`${DEVICE_SELECT} WHERE d.id = ?`, [deviceId]);
    res.status(201).json({ device, message: 'دستگاه و سفارش تعمیر ان ثبت شد.' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['customer_id', 'device_type', 'brand', 'model', 'issue_description']);
    const {
      customer_id,
      device_type,
      brand,
      model,
      serial_number,
      issue_description,
      received_date,
      expected_delivery_date,
      technician_notes
    } = req.body;

    assertDeviceType(device_type);
    const receivedDate = normalizeDate(received_date, 'تاریخ دریافت', { required: true });
    const expectedDate = normalizeDate(expected_delivery_date, 'تاریخ تحویل مورد انتطار');

    const result = await execute(
      `UPDATE devices SET customer_id = ?, device_type = ?, brand = ?, model = ?, serial_number = ?,
              issue_description = ?, received_date = ?, expected_delivery_date = ?
       WHERE id = ?`,
      [
        customer_id,
        device_type,
        String(brand).trim(),
        String(model).trim(),
        serial_number || null,
        String(issue_description).trim(),
        receivedDate,
        expectedDate,
        req.params.id
      ]
    );
    if (!result.affectedRows) throw notFound('دستگاه موردنطر پیدا نشد.');

    if (technician_notes !== undefined) {
      await execute('UPDATE repairs SET technician_notes = ? WHERE device_id = ?', [
        technician_notes || null,
        req.params.id
      ]);
    }

    const device = await queryOne(`${DEVICE_SELECT} WHERE d.id = ?`, [req.params.id]);
    res.json({ device, message: 'اطلاعات دستگاه ویرایش شد.' });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await execute('DELETE FROM devices WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) throw notFound('دستگاه موردنطر پیدا نشد.');
    res.json({ message: 'دستگاه و سابقه تعمیر ان حذف شد.' });
  })
);

export default router;
