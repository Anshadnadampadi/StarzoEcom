import express from 'express';
import { getUserOrders, getUserOrderDetails, cancelOrder, requestReturn } from '../../controllers/user/orderController.js';
import { ensureLoggedIn } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/orders', ensureLoggedIn, getUserOrders);
router.post('/orders/cancel', ensureLoggedIn, cancelOrder);
router.post('/orders/return', ensureLoggedIn, requestReturn);
router.get('/orders/:id', ensureLoggedIn, getUserOrderDetails);

export default router;
