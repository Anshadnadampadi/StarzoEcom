import mongoose from 'mongoose';
import Order from '../../models/order/order.js';
import Product from '../../models/product/Product.js';
import { isSameVariant } from '../../utils/productHelpers.js';

/**
 * Periodically reclaims stock from orders that were started but never paid.
 * Default timeout: 30 minutes
 */
export const reclaimStockFromPendingOrders = async (timeoutMinutes = 30) => {
    try {
        const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
        
        // Find orders that are Pending and older than the timeout
        const expiredOrders = await Order.find({
            orderStatus: 'Pending',
            paymentMethod: 'ONLINE PAYMENT',
            createdAt: { $lt: timeoutDate }
        });

        if (expiredOrders.length === 0) return;

        console.log(`[CLEANUP] Found ${expiredOrders.length} expired pending orders. Processing...`);

        const Coupon = mongoose.model('Coupon');

        for (const order of expiredOrders) {
            // 1. Mark as Cancelled
            order.orderStatus = 'Cancelled';
            order.paymentStatus = 'Failed';
            order.cancellationReason = 'Payment Timeout (Auto-cancelled)';
            
            // 2. Rollback Stock
            for (const item of order.items) {
                const product = await Product.findById(item.product);
                if (product) {
                    if (item.variant && product.variants?.length > 0) {
                        const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                        if (variantIndex > -1) {
                            product.variants[variantIndex].stock += item.qty;
                        }
                    } else {
                        product.stock += item.qty;
                    }
                    await product.save();
                }
            }

            // 3. Rollback Coupon
            if (order.couponCode) {
                const coupon = await Coupon.findOne({ code: order.couponCode });
                if (coupon) {
                    coupon.usedBy = coupon.usedBy.filter(id => id.toString() !== order.user.toString());
                    await coupon.save();
                }
            }

            await order.save();
            console.log(`[CLEANUP] Order #${order.orderId} cancelled, stock and coupon restored.`);
        }

    } catch (error) {
        console.error("[CLEANUP ERROR] Failed to run pending order cleanup:", error);
    }
};
