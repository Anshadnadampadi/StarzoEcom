import express from 'express';
import { getCheckout, placeOrder, verifyPayment, getOrderSuccess } from '../../controllers/user/checkoutController.js';
import { ensureLoggedIn } from '../../middlewares/authMiddleware.js';

const router = express.Router();

// Render checkout page
router.get('/', ensureLoggedIn, getCheckout);

// Place an order
router.post('/place-order', ensureLoggedIn, placeOrder);

// Verify payment (e.g. razorpay)
router.post('/verify-payment', ensureLoggedIn, verifyPayment);

// Order Success Page
router.get('/success/:orderId', ensureLoggedIn, getOrderSuccess);

export default router;
