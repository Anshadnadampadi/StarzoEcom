import express from 'express';
import {
    getAdminLogin,
    postAdminLogin,
    adminLogout,
    getAdminDashboard,
    getAdminManagement,
    postBlock,
    postUnblock,
    postDelete,
    postEdit,
    getChartData
} from '../../controllers/admin/adminControlller.js';

import adminAuth from "../../middlewares/adminAuth.js";
import categoryRoutes from '../products/categoryRoutes.js';
import productRoutes from '../products/productRoutes.js';
import adminOrderRoutes from './adminOrderRoutes.js';
import couponRoutes from './adminCoupon.js';
import offerRoutes from './adminOfferRoutes.js';
import salesReportRoutes from './salesReportRoutes.js';
import adminSettingsRoutes from './adminSettingsRoutes.js';
import { getNotifications, markAsRead, markAllAsRead, clearAllNotifications } from '../../controllers/admin/notificationController.js';

const router = express.Router();

// ... existing code ...

//  Public Routes
router.get('/login', getAdminLogin);
router.post('/login', postAdminLogin);

//  Protect everything below
router.use(adminAuth);

// Notifications API (Protected)
router.get('/api/notifications', getNotifications);
router.patch('/api/notifications/read-all', markAllAsRead);
router.delete('/api/notifications/clear-all', clearAllNotifications);
router.patch('/api/notifications/:id/read', markAsRead);
router.get('/api/dashboard/chart-data', getChartData);

//  Protected Routes
router.get('/logout', adminLogout);

router.use('/', categoryRoutes);
router.use('/', productRoutes);
router.use('/', adminOrderRoutes)
router.use("/", couponRoutes);
router.use("/marketing/offers", offerRoutes);
router.use("/", salesReportRoutes);
router.use("/", adminSettingsRoutes);

// Dashboard & Users
router.get('/dashboard', getAdminDashboard);
router.get('/notifications', (req, res) => res.render('admin/notifications/index', { title: 'System Protocol' }));
router.get('/marketing/banners', (req, res) => res.render('admin/marketing/banners', { title: 'Banners' }));
router.get('/customers', getAdminManagement);

router.post('/block/:id', postBlock);
router.post('/unblock/:id', postUnblock);
router.post('/delete/:id', postDelete);
router.post('/edit', postEdit);

export default router;