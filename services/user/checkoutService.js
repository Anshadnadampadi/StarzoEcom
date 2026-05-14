import crypto from 'crypto';
import Order from '../../models/order/order.js';
import Product from '../../models/product/Product.js';
import User from '../../models/user/User.js';
import Wallet from '../../models/user/Wallet.js';
import Cart from '../../models/cart/cart.js';
import * as cartService from './cartService.js';
import { isSameVariant } from '../../utils/productHelpers.js';
import { createAdminNotification } from '../../utils/notificationHelper.js';
import Coupon from '../../models/coupon/coupon.js';
import razorpay from '../../config/razorpay.js';

export const placeOrderService = async (userId, orderData) => {
    const { addressId, paymentMethod, couponCode } = orderData;
    
    const cart = await cartService.getCartData(userId);
    if (!cart || cart.items.length === 0) {
        return { success: false, message: 'Cart is empty.', status: 400 };
    }

    if (cart.items.some(i => i.isUnavailable || i.isOutOfStock || i.insufficientStock)) {
        return { 
            success: false, 
            message: 'Some items in your cart are no longer available or out of stock.', 
            status: 400 
        };
    }

    const user = await User.findById(userId).populate("addresses");
    if (!user || user.isBlocked) {
        return { success: false, message: 'User unauthorized or blocked.', status: 403, terminate: true };
    }

    const address = user.addresses.find(a => a._id.toString() === addressId);
    if (!address) {
        return { success: false, message: 'Address not found or unauthorized.', status: 404 };
    }

    const originalSubtotal = cart.originalSubtotal || cart.subtotal || 0;
    let subtotal = cart.subtotal || 0;
    
    let discount = 0;
    let appliedCoupon = null;

    // Safety limit: Total discount (Offer + Coupon) cannot exceed 50% of original price
    const MAX_TOTAL_DISCOUNT_PERCENT = 50; 
    const currentOfferDiscount = Math.max(0, originalSubtotal - subtotal);

    if (couponCode) {
        const coupon = await Coupon.findOne({ 
            code: couponCode.trim().toUpperCase(),
            isActive: true
        });

        if (coupon) {
            // 1. Expiry Check
            if (new Date(coupon.expiryDate) < new Date()) {
                return { success: false, message: 'This coupon has expired.', status: 400 };
            }

            // 2. Minimum Amount Check (Against current subtotal after offers)
            if (subtotal < coupon.minAmount) {
                return { success: false, message: `Minimum purchase of ₹${coupon.minAmount} required for this coupon.`, status: 400 };
            }

            // 3. Usage Check
            const hasUsed = coupon.usedBy.some(id => id.toString() === userId.toString());
            if (hasUsed) {
                return { success: false, message: 'You have already used this coupon.', status: 400 };
            }
            if (coupon.usedBy.length >= coupon.usageLimit) {
                return { success: false, message: 'Coupon usage limit reached.', status: 400 };
            }

            // 4. Calculate Discount
            let potentialCouponDiscount = 0;
            if (coupon.discountType === 'percentage') {
                potentialCouponDiscount = Math.floor(subtotal * (coupon.discountValue / 100));
                if (coupon.maxDiscount && potentialCouponDiscount > coupon.maxDiscount) {
                    potentialCouponDiscount = coupon.maxDiscount;
                }
            } else {
                potentialCouponDiscount = coupon.discountValue;
            }

            // 5. Apply Safety Limit (Offer + Coupon <= 50%)
            const maxAllowedTotalDiscount = Math.floor(originalSubtotal * (MAX_TOTAL_DISCOUNT_PERCENT / 100));
            const remainingDiscountGap = Math.max(0, maxAllowedTotalDiscount - currentOfferDiscount);
            
            discount = Math.min(potentialCouponDiscount, remainingDiscountGap);
            appliedCoupon = coupon;

            if (discount <= 0 && potentialCouponDiscount > 0) {
                return { success: false, message: 'Coupon cannot be applied due to existing heavy offers on items.', status: 400 };
            }
        } else {
            return { success: false, message: 'Invalid or inactive coupon code.', status: 400 };
        }
    }
    
    // Final check: Calculate tax and total correctly
    const totalTaxable = Math.max(0, subtotal - discount);
    const tax = Math.floor(totalTaxable * 0.18); 
    const shippingFee = subtotal > 500 ? 0 : 50; 
    
    let totalAmount = Math.max(0, subtotal + tax + shippingFee - discount);
    const orderId = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 1. Pre-validate stock for ALL items to ensure atomic reservation
    for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (!product) continue;

        let availableStock = 0;
        let identifier = product.name;

        if (item.variant && product.variants.length > 0) {
            const variant = product.variants.find(v => isSameVariant(v, item.variant));
            if (variant) {
                availableStock = (variant.stock || 0) - (variant.reservedStock || 0);
                identifier = `${product.name} (${variant.color} ${variant.storage})`;
            }
        } else {
            availableStock = (product.stock || 0) - (product.reservedStock || 0);
        }

        if (availableStock < item.qty) {
            return { 
                success: false, 
                message: `Insufficient stock for ${identifier}. Available: ${availableStock}`, 
                status: 400 
            };
        }
    }

    // 2. Reserve stock first
    for (const item of cart.items) {
        const product = await Product.findById(item.product._id);
        if (!product) continue;

        if (item.variant && product.variants.length > 0) {
            const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
            if (variantIndex > -1) {
                const variant = product.variants[variantIndex];
                const availableStock = (variant.stock || 0) - (variant.reservedStock || 0);
                if (availableStock >= item.qty) {
                    variant.reservedStock = (variant.reservedStock || 0) + item.qty;
                } else {
                    return { success: false, message: `Insufficient stock for ${product.name} (${variant.color} ${variant.storage})`, status: 400 };
                }
            }
        } else {
            const availableStock = (product.stock || 0) - (product.reservedStock || 0);
            if (availableStock >= item.qty) {
                product.reservedStock = (product.reservedStock || 0) + item.qty;
            } else {
                return { success: false, message: `Insufficient stock for ${product.name}`, status: 400 };
            }
        }
        await product.save();
    }

    // 2. If immediate payment (COD/Wallet), finalize the stock reduction right away
    if (paymentMethod !== 'ONLINE PAYMENT') {
        for (const item of cart.items) {
            await finalizeStockSale(item.product._id, item.variant, item.qty);
        }
    }

    // --- CLEANUP RECENT ABANDONED ORDERS ---
    // If user has previous "Pending" online orders for the SAME ITEMS, we should cleanup
    // before they place a NEW one. This prevents stock bloat.
    const existingPendingOrders = await Order.find({ 
        user: userId, 
        orderStatus: 'Pending', 
        paymentMethod: 'ONLINE PAYMENT',
        $or: [
            { paymentStatus: 'Pending' },
            { paymentStatus: 'Failed' }
        ]
    });
    
    for (const oldOrder of existingPendingOrders) {
        // If the old order is very recent (last 30 mins), we might want to keep it
        // but for simplicity and to follow the "dont lose cart" requirement, 
        // we'll only revert if they are specifically placing a new order now.
        await revertFailedOrderService(oldOrder.orderId, userId);
    }

    let remainingDiscount = discount;
    const mappedItems = cart.items.map((item, index) => {
        const itemTotal = item.price * item.qty;
        const itemRatio = subtotal > 0 ? itemTotal / subtotal : 0;
        let itemDiscount = Math.floor(discount * itemRatio);

        if (index === cart.items.length - 1) {
            itemDiscount = remainingDiscount; // Allocate remainder to the last item
        }
        remainingDiscount -= itemDiscount;

        const finalPaidAmount = Math.max(0, itemTotal - itemDiscount);

        return {
            product: item.product._id,
            productName: item.product.name,
            productImage: item.displayImage,
            variant: item.variant,
            qty: item.qty,
            price: item.price,
            couponDiscount: itemDiscount,
            finalPaidAmount: finalPaidAmount
        };
    });

    const newOrder = new Order({
        orderId,
        user: userId,
        items: mappedItems,
        shippingAddress: {
            fullName: address.name,
            phone: address.phone,
            streetAddress: `${address.addr1} ${address.addr2 || ''}`.trim(),
            city: address.city,
            state: address.state,
            pinCode: address.zip,
            country: address.country
        },
        subtotal, tax, shippingFee, discount, totalAmount, couponCode, paymentMethod,
        paymentStatus: paymentMethod === 'WALLET' ? 'Paid' : 'Pending', 
        orderStatus: paymentMethod === 'ONLINE PAYMENT' ? 'Pending' : 'Confirmed'
    });

    // If Wallet payment, deduct balance
    if (paymentMethod === 'WALLET') {
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet || wallet.balance < totalAmount) {
            return { success: false, message: 'Insufficient wallet balance.', status: 400 };
        }

        wallet.balance -= totalAmount;
        wallet.transactions.push({
            amount: totalAmount,
            type: 'debit',
            description: `Payment for Order #${orderId}`,
            txnId: `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
            orderId: orderId,
            status: 'Success',
            timestamp: new Date()
        });
        await wallet.save();
    }

    // If Razorpay, create razorpay order
    let razorpayOrder = null;
    if (paymentMethod === 'ONLINE PAYMENT') {
        const options = {
            amount: Math.round(totalAmount * 100), // in paise
            currency: "INR",
            receipt: orderId,
        };
        try {
            razorpayOrder = await razorpay.orders.create(options);
            newOrder.razorpayOrderId = razorpayOrder.id;
        } catch (err) {
            console.error("Razorpay Order Creation Error:", err);
            return { success: false, message: 'Failed to initiate online payment.', status: 500 };
        }
    }

    await newOrder.save();

    // If coupon used, update coupon stats only if not online payment
    // Online payments update stats in verifyPaymentService
    if (appliedCoupon && paymentMethod !== 'ONLINE PAYMENT') {
        appliedCoupon.usedBy.push(userId);
        await appliedCoupon.save();
    }

    // Clear cart ONLY for immediate payments (COD/Wallet). 
    // Online payments will clear the cart after verification to satisfy user requirement: 
    // "dont remove the cart product if payment is failed"
    if (paymentMethod !== 'ONLINE PAYMENT') {
        await cartService.clearCart(userId);
    }

    // If not Online Payment, we can finalize notifications
    if (paymentMethod !== 'ONLINE PAYMENT') {
        // Admin Alert
        await createAdminNotification({
            type: 'order_placed',
            title: 'New Order Received',
            message: `Order #${newOrder.orderId} has been placed by ${user.name || user.email}. Total: ₹${newOrder.totalAmount.toLocaleString()}`,
            orderId: newOrder._id
        });
    }

    return { 
        success: true, 
        message: 'Order placed successfully', 
        orderId: newOrder.orderId,
        dbOrderId: newOrder._id,
        razorpayOrder: razorpayOrder,
        paymentMethod
    };
};

export const verifyPaymentService = async (paymentData) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = paymentData;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest("hex");

    if (razorpay_signature === expectedSign) {
        const order = await Order.findOne({ orderId: orderId });
        if (order) {
            order.paymentStatus = 'Paid';
            order.orderStatus = 'Confirmed';
            order.razorpayPaymentId = razorpay_payment_id;
            order.razorpaySignature = razorpay_signature;
            await order.save();

            // Track coupon usage if a coupon was applied
            if (order.couponCode) {
                const coupon = await Coupon.findOne({ code: order.couponCode });
                if (coupon && !coupon.usedBy.includes(order.user)) {
                    coupon.usedBy.push(order.user);
                    await coupon.save();
                }
            }

            // Finalize Stock (Convert reservation to sale)
            for (const item of order.items) {
                await finalizeStockSale(item.product, item.variant, item.qty);
            }

            // Clear Cart
            await cartService.clearCart(order.user);

            // Admin Alert (Non-blocking)
            createAdminNotification({
                type: 'order_placed',
                title: 'New Online Order',
                message: `Order #${order.orderId} (Online) confirmed. Total: ₹${order.totalAmount.toLocaleString()}`,
                orderId: order._id
            }).catch(err => console.error("Admin notification error:", err));

            return { success: true, message: 'Payment verified successfully.' };
        }
    }

    return { success: false, message: 'Payment verification failed.' };
};

export const retryPaymentService = async (orderId, userId) => {
    const order = await Order.findOne({ orderId: orderId, user: userId });
    
    if (!order) {
        throw new Error("Order not found");
    }

    if (order.orderStatus !== 'Pending') {
        throw new Error(`Order cannot be paid. Status: ${order.orderStatus}`);
    }

    if (order.paymentMethod !== 'ONLINE PAYMENT') {
        throw new Error("Only online payments can be retried");
    }

    // Create a NEW Razorpay order for the retry
    const options = {
        amount: Math.round(order.totalAmount * 100),
        currency: "INR",
        receipt: order.orderId,
    };

    try {
        const razorpayOrder = await razorpay.orders.create(options);
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        return {
            success: true,
            orderId: order.orderId,
            razorpayOrder: razorpayOrder
        };
    } catch (err) {
        console.error("Retry Payment Error:", err);
        throw new Error("Failed to initiate payment retry");
    }
};

export const revertFailedOrderService = async (orderId, userId) => {
    // Find the order that is still pending or failed
    const order = await Order.findOne({ 
        orderId, 
        user: userId, 
        $or: [{ paymentStatus: 'Pending' }, { paymentStatus: 'Failed' }] 
    });
    if (!order) {
        return { success: true, message: 'Order already processed or not found.' };
    }

    // Release reserved stock
    for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
            if (item.variant) {
                const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                if (variantIndex > -1) {
                    product.variants[variantIndex].reservedStock = Math.max(0, (product.variants[variantIndex].reservedStock || 0) - item.qty);
                }
            } else {
                product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.qty);
            }
            await product.save();
        }
    }

    // Restore Coupon usage
    let couponIdToRestore = null;
    if (order.couponCode) {
        const coupon = await Coupon.findOne({ code: order.couponCode });
        if (coupon) {
            // Remove only ONE instance of the user's usage (fix for multiple usage coupons)
            const usageIndex = coupon.usedBy.findIndex(id => id.toString() === userId.toString());
            if (usageIndex > -1) {
                coupon.usedBy.splice(usageIndex, 1);
                await coupon.save();
                couponIdToRestore = coupon._id;
            }
        }
    }

    // Restore Cart items
    const cart = await Cart.findOne({ userId });
    if (cart) {
        for (const item of order.items) {
            const exists = cart.items.find(i => 
                i.product.toString() === item.product.toString() && 
                isSameVariant(i.variant, item.variant)
            );
            if (!exists) {
                cart.items.push({
                    product: item.product,
                    variant: item.variant,
                    qty: item.qty,
                    price: item.price,
                    originalPrice: item.price // Fallback
                });
            }
        }
        
        // Restore the coupon back to the cart
        if (couponIdToRestore) {
            cart.coupon = couponIdToRestore;
        }
        
        await cart.save();
        await cartService.updateCartTotals(userId);
    }

    // Finally delete the failed/abandoned order
    await Order.findByIdAndDelete(order._id);

    return { success: true, message: 'Order reverted and items returned to cart.' };
};

/**
 * Cleanup abandoned pending orders older than 1 hour
 */
export const cleanupAbandonedOrders = async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const abandonedOrders = await Order.find({
        orderStatus: 'Pending',
        paymentMethod: 'ONLINE PAYMENT',
        $or: [
            { paymentStatus: 'Pending' },
            { paymentStatus: 'Failed' }
        ],
        createdAt: { $lt: oneHourAgo }
    });

    if (abandonedOrders.length > 0) {
        console.log(`[CRON] Cleaning up ${abandonedOrders.length} abandoned/failed online orders...`);
        for (const order of abandonedOrders) {
            try {
                await revertFailedOrderService(order.orderId, order.user);
            } catch (err) {
                console.error(`[CRON] Failed to revert order ${order.orderId}:`, err);
            }
        }
    }
};
/**
 * Helper to convert a stock reservation into a permanent sale
 * Decrements both physical stock and reserved stock
 */
async function finalizeStockSale(productId, variant, qty) {
    const product = await Product.findById(productId);
    if (!product) return;

    if (variant && product.variants.length > 0) {
        const variantIndex = product.variants.findIndex(v => isSameVariant(v, variant));
        if (variantIndex > -1) {
            product.variants[variantIndex].stock -= qty;
            product.variants[variantIndex].reservedStock = Math.max(0, (product.variants[variantIndex].reservedStock || 0) - qty);
        }
    } else {
        product.stock -= qty;
        product.reservedStock = Math.max(0, (product.reservedStock || 0) - qty);
    }
    await product.save();
}
