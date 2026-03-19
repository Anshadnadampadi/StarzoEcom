import { Router } from 'express';
const router = Router();


import {
    getAdminLogin,
    postAdminLogin,
    adminLogout,
} from '../../controllers/admin/adminControlller.js';

// Admin Login Routes
router.get('/login', getAdminLogin);
router.post('/login', postAdminLogin);
router.get('/logout', adminLogout)


export default router