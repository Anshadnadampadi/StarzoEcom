import * as cartService from "../../services/user/cartService.js";
import User from "../../models/user/User.js";

export const getCheckout = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/auth/login");
        }

        const cart = await cartService.getCartData(req.session.user);

        if (!cart || cart.items.length === 0) {
            return res.redirect("/cart?msg=Your cart is empty&icon=warning");
        }

        // Final Stock Validation
        const hasStockIssues = cart.items.some(i => i.isOutOfStock || i.insufficientStock);
        if (hasStockIssues) {
            return res.redirect("/cart?msg=Some items in your cart are out of stock. Please resolve to continue.&icon=error");
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

import Product from "../../models/product/Product.js";
import crypto from 'crypto';

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

        const user = await User.findById(userId).populate("addresses");
        const address = user.addresses.find(a => a._id.toString() === addressId);
        
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found or unauthorized.' });
        }

        let subtotal = cart.subtotal || 0;
        let discount = 0;
        let tax = 0; 
        let shippingFee = subtotal > 500 ? 0 : 50; 
        
        let totalAmount = subtotal - discount + tax + shippingFee;

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
                if (product.stock >= item.qty) {
                    product.stock -= item.qty;
                }
                if (item.variant && product.variants.length > 0) {
                    const variantIndex = product.variants.findIndex(v => v._id.toString() === item.variant || v.color === item.variant);
                    if (variantIndex > -1 && product.variants[variantIndex].stock >= item.qty) {
                        product.variants[variantIndex].stock -= item.qty;
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
            paymentStatus: paymentMethod === 'CASH ON DELIVERY' ? 'Pending' : 'Completed', 
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
