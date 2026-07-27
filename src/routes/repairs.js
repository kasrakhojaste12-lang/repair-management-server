import express from 'express';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import { asyncHandler, badRequest, getPagination, notFound, searchTerm } from '../utils/http.js';

const router = express.Router();

const STATUSES = [
  'received',
  'inspection',
  'waiting_parts',
  'in_repair',
  'completed',
  'delivered'
];

const REPAIR_SELECT = `
  SELECT r.id, r.device_id, r.status, r.payment_status, r.technician_notes,
         r.parts_cost, r.labor_cost, r.additional_cost, r.total_cost,
         r.paid_at, r.delivered_at, r.created_at, r.updated_at,
         d.customer_id, c.full_name AS customer_name, c.phone AS customer_phone,
         d.device_type, d.brand, d.model, d.serial_number, d.issue_description,
         d.received_date, d.expected_delivery_date
  FROM repairs r
  JOIN devices d ON d.id = r.device_id
  JOIN customers c ON c.id = d.customer_id`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPagination(req.query);
    const term = searchTerm(req.query);
    const conditions = [];
    const params = [];

    if (term) {
      conditions.push('(c.full_name LIKE ? OR d.brand LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)');
      params.push(term, term, term, term);
    }
    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) throw badRequest('وضعیت تعمیر معتبر نیست.');
      conditions.push('r.status = ?');
      params.push(req.query.status);
    }
    if (req.query.payment_status) {
      if (!['paid', 'unpaid'].includes(req.query.payment_status)) {
        throw badRequest('وضعیت پرداخت معتبر نیست.');
      }
      conditions.push('r.payment_status = ?');
      params.push(req.query.payment_status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const data = await query(`${REPAIR_SELECT} ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset
    ]);
    const totals = await queryOne(
      `SELECT COUNT(*) AS total
       FROM repairs r
       JOIN devices d ON d.id = r.device_id
       JOIN customers c ON c.id = d.customer_id ${where}`,
      params
    );

    res.json({ data, pagination: { page, limit, total: Number(totals?.total) || 0 } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const repair = await queryOne(`${REPAIR_SELECT} WHERE r.id = ?`, [req.params.id]);
    if (!repair) throw notFound('سفارش تعمیر موردنطر پیدا نشد.');

    const history = await query(
      `SELECT h.id, h.status, h.notes, h.created_at, u.full_name AS changed_by_name
       FROM repair_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.repair_id = ?
       ORDER BY h.created_at ASC, h.id ASC`,
      [req.params.id]
    );

    res.json({ repair, history, ...repair });
  })
);

// کلاینت ممکن است یادداشت را با کلید technician_notes یا notes بفرستد؛ هر دو را قبول می‌کنیم
function readNotes(body) {
  const value = body?.technician_notes ?? body?.notes;
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw badRequest('وضعیت تعمیر معتبر نیست.');

    const repair = await queryOne('SELECT id, status FROM repairs WHERE id = ?', [req.params.id]);
    if (!repair) throw notFound('سفارش تعمیر موردنطر پیدا نشد.');

    const notes = readNotes(req.body);

    await withTransaction(async (connection) => {
      await connection.query(
        `UPDATE repairs
         SET status = ?,
             technician_notes = COALESCE(?, technician_notes),
             delivered_at = CASE WHEN ? = 'delivered' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END
         WHERE id = ?`,
        [status, notes, status, req.params.id]
      );

      await connection.query(
        'INSERT INTO repair_status_history (repair_id, status, notes, changed_by) VALUES (?, ?, ?, ?)',
        [req.params.id, status, notes, req.user.id]
      );
    });

    const updated = await queryOne(`${REPAIR_SELECT} WHERE r.id = ?`, [req.params.id]);
    res.json({ repair: updated, message: 'وضعیت تعمیر به‌روز شد.' });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const notes = readNotes(req.body);
    const result = await execute(
      'UPDATE repairs SET technician_notes = COALESCE(?, technician_notes) WHERE id = ?',
      [notes, req.params.id]
    );
    if (!result.affectedRows) throw notFound('سفارش تعمیر موردنطر پیدا نشد.');

    const repair = await queryOne(`${REPAIR_SELECT} WHERE r.id = ?`, [req.params.id]);
    res.json({ repair, message: 'سفارش تعمیر ویرایش شد.' });
  })
);

export default router;
