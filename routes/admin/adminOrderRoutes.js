import express from 'express';
import { getOrders, getOrderDetails, updateOrderStatus, updateItemReturnStatus } from '../../controllers/admin/orderController.js';

const router = express.Router();

router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetails);
router.patch('/orders/status', updateOrderStatus);
router.patch('/orders/item-return', updateItemReturnStatus);

export default router;
