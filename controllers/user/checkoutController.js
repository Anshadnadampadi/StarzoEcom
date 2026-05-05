import * as cartService from "../../services/user/cartService.js";
import User from "../../models/user/User.js";
import Wallet from "../../models/user/Wallet.js";
import Order from "../../models/order/order.js";
import { placeOrderService, verifyPaymentService, retryPaymentService, revertFailedOrderService } from "../../services/user/checkoutService.js";
import { applyCouponService, getAvailableCouponsService, removeCouponService } from "../../services/user/couponService.js";
import { sendAdminNotification } from "../../utils/notificationHelper.js";


export const getCheckout = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect("/auth/login");

        const cart = await cartService.getCartData(req.session.user);
        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?msg=Your cart is empty&icon=warning");
        }

        const hasIssues = cart.items.some(i => i.isOutOfStock || i.insufficientStock || i.isUnavailable);
        if (hasIssues) {
            return res.redirect("/cart?msg=Some items in your cart are no longer available.&icon=error");
        }

        const user = await User.findById(req.session.user).populate("addresses").lean();
        const wallet = await Wallet.findOne({ user: req.session.user }).lean();
        const availableCoupons = await getAvailableCouponsService(req.session.user);

        res.render("user/checkout", {
            title: "Checkout",
            cart, user,
            addresses: user.addresses || [],
            walletBalance: wallet ? wallet.balance : 0,
            availableCoupons,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            breadcrumbs: [
                { label: 'Shop', url: '/products' },
                { label: 'Cart', url: '/cart' },
                { label: 'Checkout', url: '/checkout' }
            ],
            hideAiChat: true
        });

    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).render("errors/error", { message: "Failed to load checkout page" });
    }
};



export const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const result = await placeOrderService(userId, req.body);

        if (!result.success) {
            if (result.terminate && req.session) {
                req.session.destroy();
                res.clearCookie('userSid', { path: '/' });
            }
            return res.status(result.status || 400).json(result);
        }

        // Emit socket notification to admin only for non-online payments
        // Online payments will trigger this after verification
        if (result.paymentMethod !== 'ONLINE PAYMENT') {
            await sendAdminNotification(req.app, {
                type: 'order_placed',
                title: 'New Order Placed',
                message: `Order #${result.orderId} has been placed.`,
                orderId: result.dbOrderId
            });
        }

        res.status(200).json(result);

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const result = await verifyPaymentService(req.body);

        if (result.success) {
            // Emit socket notification for confirmed online payment
            const order = await Order.findOne({ orderId: req.body.orderId });
            if (order) {
                await sendAdminNotification(req.app, {
                    type: 'order_placed',
                    title: 'Online Payment Confirmed',
                    message: `Online payment for Order #${order.orderId} has been verified.`,
                    orderId: order._id
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};


export const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId, user: req.session.user });

        if (!order) return res.redirect('/');

        res.render('user/orderSuccess', {
            title: 'Order Confirmation',
            order,
            hideAiChat: true
        });
    } catch (error) {
        console.error('Error fetching order success:', error);
        res.redirect('/');
    }
};

export const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user;
        const result = await applyCouponService(userId, code);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        const result = await removeCouponService(userId);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getPaymentFailure = async (req, res) => {
    try {
        const orderId = req.query.orderId || 'UNKNOWN';
        const order = await Order.findOne({ orderId, user: req.session.user });

        res.render('user/paymentFailure', {
            title: 'Payment Failed',
            orderId,
            order: order || null,
            hideAiChat: true
        });
    } catch (error) {
        console.error('Error in payment failure:', error);
        res.redirect('/');
    }
};
export const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user;
        const result = await retryPaymentService(orderId, userId);
        res.json(result);
    } catch (error) {
        console.error('Error retrying payment:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

export const revertFailedOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user;
        const result = await revertFailedOrderService(orderId, userId);
        res.json(result);
    } catch (error) {
        console.error('Error reverting failed order:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
