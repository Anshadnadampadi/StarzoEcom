import Order from '../models/order/order.js';
import { revertFailedOrderService } from '../services/user/checkoutService.js';

/**
 * Periodically cleans up abandoned pending orders
 * Should be called by a cron job or a scheduled task
 */
export const startOrderCleanupTask = () => {
    // Run every 1 hour
    setInterval(async () => {
        try {
            console.log('[CRON] Starting abandoned order cleanup...');
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            
            const abandonedOrders = await Order.find({
                orderStatus: 'Pending',
                paymentMethod: 'ONLINE PAYMENT',
                createdAt: { $lt: oneHourAgo }
            });

            if (abandonedOrders.length > 0) {
                console.log(`[CRON] Found ${abandonedOrders.length} abandoned orders to cleanup.`);
                for (const order of abandonedOrders) {
                    try {
                        await revertFailedOrderService(order.orderId, order.user);
                        console.log(`[CRON] Reverted abandoned order: ${order.orderId}`);
                    } catch (err) {
                        console.error(`[CRON] Failed to revert order ${order.orderId}:`, err);
                    }
                }
            } else {
                console.log('[CRON] No abandoned orders found.');
            }
        } catch (error) {
            console.error('[CRON] Order cleanup task error:', error);
        }
    }, 60 * 60 * 1000); // 1 hour
};
