import express from 'express';
import { getAdminLogin,
      postAdminLogin, 
      adminLogout,
      getAdminDashboard,
      getAdminManagement,
      postBlock,
      postUnblock,
      postDelete,
      postEdit
     } from '../../controllers/admin/adminControlller.js';
import adminAuth from "../../middlewares/adminAuth.js";
import categoryRoutes from '../products/categoryRoutes.js';
import productRoutes from '../products/productRoutes.js';

const router = express.Router();

// Public Admin Routes
router.get('/login', getAdminLogin);
router.post('/login', postAdminLogin);
router.get('/logout', adminLogout);

// Protected Admin Routes (Require adminAuth)
router.use('/', adminAuth);

// Content Management
router.use('/', categoryRoutes);
router.use('/', productRoutes);

// User & Dashboard Management
router.get('/dashboard', getAdminDashboard);
router.get('/customers', getAdminManagement);
router.post('/block/:id', postBlock);
router.post('/unblock/:id', postUnblock);
router.post('/delete/:id', postDelete);
router.post('/edit', postEdit);

export default router;
