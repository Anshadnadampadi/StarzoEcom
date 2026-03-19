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
const router = express.Router();
import { adminAuth } from '../../middlewares/adminAuth.js';
import authRoutes from '../../routes/admin/authRoutes.js';
import categoryRoutes from '../../routes/admin/category/categoryRoutes.js';
import productRoutes from '../../routes/admin/product/productRoutes.js';

router.use('/auth', authRoutes);
router.use('/category', categoryRoutes);
router.use('/product', productRoutes);

router.get('/dashboard', adminAuth, getAdminDashboard);
router.get('/management', adminAuth, getAdminManagement);
router.post('/block/:id', postBlock);
router.post('/unblock/:id', postUnblock);
router.post('/delete/:id', postDelete);
router.post('/edit', postEdit);

export default router;