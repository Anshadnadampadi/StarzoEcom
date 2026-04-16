import express from 'express';
import { getOrders, getOrderDetails, updateOrderStatus } from '../../controllers/admin/orderController.js';

const router = express.Router();

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetails);
router.patch('/orders/status', updateOrderStatus);

export default router;
