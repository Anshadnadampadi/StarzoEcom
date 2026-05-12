import express from 'express';
import { getOrders, getOrderDetails, updateOrderStatus, updateItemReturnStatus, updateItemStatus } from '../../controllers/admin/orderController.js';
import { getReturnsPage } from '../../controllers/admin/returnController.js';

const router = express.Router();

router.get('/orders', getOrders);
router.get('/returns', getReturnsPage);
router.get('/orders/:id', getOrderDetails);
router.patch('/orders/status', updateOrderStatus);
router.patch('/orders/item-return', updateItemReturnStatus);
router.patch('/orders/item-status', updateItemStatus);

export default router;
