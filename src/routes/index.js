import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import authRoutes from './auth.js';
import customersRoutes from './customers.js';
import dashboardRoutes from './dashboard.js';
import devicesRoutes from './devices.js';
import invoicesRoutes from './invoices.js';
import repairCostsRoutes from './repairCosts.js';
import repairsRoutes from './repairs.js';
import reportsRoutes from './reports.js';
import usersRoutes from './users.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);

// از اینجا به بعد همه مسیرها نیاز به توکن دارند
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/customers', authenticate, customersRoutes);
router.use('/devices', authenticate, devicesRoutes);
router.use('/repairs', authenticate, repairsRoutes);
router.use('/repair-costs', authenticate, repairCostsRoutes);
router.use('/invoices', authenticate, invoicesRoutes);

// فقط مدیر سیستم
router.use('/reports', authenticate, requireAdmin, reportsRoutes);
router.use('/users', authenticate, requireAdmin, usersRoutes);

export default router;
