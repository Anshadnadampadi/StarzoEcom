import crypto from 'crypto';
import * as cartService from "../../services/user/cartService.js";
import User from "../../models/user/User.js";
import Order from "../../models/order/order.js";
import Product from "../../models/product/Product.js";
import { isSameVariant } from "../../utils/productHelpers.js";

export const getCheckout = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/auth/login");
        }

        const cart = await cartService.getCartData(req.session.user);

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?msg=Your cart is empty&icon=warning");
        }

        // Final Validation (Stock & Listing status)
        const hasIssues = cart.items.some(i => i.isOutOfStock || i.insufficientStock || i.isUnavailable);
        if (hasIssues) {
            return res.redirect("/cart?msg=Some items in your cart are no longer available. Please resolve to continue.&icon=error");
        }

        const user = await User.findById(req.session.user).populate("addresses").lean();

        res.render("user/checkout", {
            title: "Checkout",
            cart,
            user,
            addresses: user.addresses || [],
            breadcrumbs: [
                { label: 'Shop', url: '/products' },
                { label: 'Cart', url: '/cart' },
                { label: 'Checkout', url: '/checkout' }
            ]
        });

    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).render("errors/error", { message: "Failed to load checkout page" });
    }
};


export const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod, couponCode } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: 'Address and Payment Method are required.' });
        }

        const cart = await cartService.getCartData(userId);
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty.' });
        }

        // Final sanity check for stock and availability
        if (cart.items.some(i => i.isUnavailable || i.isOutOfStock || i.insufficientStock)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Some items in your cart are no longer available or out of stock. Please return to the cart to resolve issues.' 
            });
        }

        const user = await User.findById(userId).populate("addresses");
        
        if (!user || user.isBlocked) {
            console.warn(`[ORDER REJECTED] User ${userId} is blocked or not found. Terminating session.`);
            if (req.session) {
                req.session.destroy();
                res.clearCookie('connect.sid');
            }
            return res.status(403).json({ success: false, message: 'Your account has been restricted. Access denied.' });
        }

        const address = user.addresses.find(a => a._id.toString() === addressId);
        
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found or unauthorized.' });
        }

        let subtotal = cart.subtotal || 0;
        let tax = Math.floor(subtotal * 0.18); 
        let shippingFee = subtotal > 500 ? 0 : 50; 
        
        let discount = 0;
        if (couponCode && couponCode.trim().toUpperCase() === 'SYNC10') {
            discount = Math.floor((subtotal + tax) * 0.10);
        }
        
        let totalAmount = Math.max(0, subtotal + tax + shippingFee - discount);

        const orderId = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // Prepare order items
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            variant: item.variant,
            qty: item.qty,
            price: item.price
        }));

        // Reduce stock
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            if (product) {
                if (item.variant && product.variants.length > 0) {
                    const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                    if (variantIndex > -1) {
                        if (product.variants[variantIndex].stock >= item.qty) {
                            product.variants[variantIndex].stock -= item.qty;
                        } else {
                            throw new Error(`Insufficient stock for ${product.name} (${item.variantDisplay})`);
                        }
                    }
                } else {
                    if (product.stock >= item.qty) {
                        product.stock -= item.qty;
                    } else {
                        throw new Error(`Insufficient stock for ${product.name}`);
                    }
                }
                await product.save();
            }
        }

        const newOrder = new Order({
            orderId,
            user: userId,
            items: orderItems,
            shippingAddress: {
                fullName: address.name,
                phone: address.phone,
                streetAddress: `${address.addr1} ${address.addr2 || ''}`.trim(),
                city: address.city,
                state: address.state,
                pinCode: address.zip,
                country: address.country
            },
            subtotal,
            tax,
            shippingFee,
            discount,
            totalAmount,
            couponCode,
            paymentMethod,
            paymentStatus: paymentMethod === 'CASH ON DELIVERY' ? 'Pending' : 'Paid', 
            orderStatus: 'Processing'
        });

        await newOrder.save();

        // Clear cart
        await cartService.clearCart(userId);

        return res.status(200).json({ 
            success: true, 
            message: 'Order placed successfully', 
            orderId: newOrder.orderId 
        });

    } catch (error) {
        console.error('Error placing order:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const verifyPayment = async (req, res) => {
    res.json({ success: true });
};

export const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId, user: req.session.user });

        if (!order) {
            return res.redirect('/');
        }

        res.render('user/orderSuccess', {
            title: 'Order Confirmation',
            order
        });
    } catch (error) {
        console.error('Error fetching order success:', error);
        res.redirect('/');
    }
};
