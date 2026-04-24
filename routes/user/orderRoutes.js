import express from 'express';
import { getUserOrders, getUserOrderDetails, cancelOrder, cancelOrderItem, requestReturn, returnOrderItem, downloadInvoice, downloadCreditNote } from '../../controllers/user/orderController.js';
import { ensureLoggedIn } from '../../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/orders', ensureLoggedIn, getUserOrders);
router.post('/orders/cancel', ensureLoggedIn, cancelOrder);
router.post('/orders/cancel-item', ensureLoggedIn, cancelOrderItem);
router.post('/orders/return', ensureLoggedIn, requestReturn);
router.post('/orders/return-item', ensureLoggedIn, returnOrderItem);
router.get('/orders/:id', ensureLoggedIn, getUserOrderDetails);
router.get('/orders/:id/invoice', ensureLoggedIn, downloadInvoice);
router.get('/orders/:id/credit-note', ensureLoggedIn, downloadCreditNote);

export default router;
