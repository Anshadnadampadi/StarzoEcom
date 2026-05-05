import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';
import Wallet from '../../models/user/Wallet.js';
import User from '../../models/user/User.js';
import { isSameVariant } from '../../utils/productHelpers.js';
import { createAdminNotification } from '../../utils/notificationHelper.js';
import { recalculateOrderTotals, calculateItemRefund } from '../../utils/orderCalculations.js';

// recalculateOrderTotals moved to utils/orderCalculations.js

export const getUserOrdersService = async (userId, search, status, page, limit) => {
    const skip = (page - 1) * limit;
    const filter = { user: userId };

    // Status Filter
    if (status && status !== 'all') {
        const s = status.toLowerCase();
        if (s === 'processing') {
            filter['items.status'] = { $in: ['Ordered', 'Shipped', 'Pending', 'Processing', 'Confirmed'] };
        } else if (s === 'returned') {
            filter['items.status'] = { $in: ['Returned', 'Return Requested', 'Return Approved', 'Return Picked'] };
        } else if (s === 'pending') {
            filter.orderStatus = 'Pending';
        } else {
            filter['items.status'] = new RegExp(`^${status}$`, 'i');
        }
    }

    if (search) {
        // Find products matching search
        const productIds = await Product.find({
            name: { $regex: search, $options: 'i' }
        }).distinct('_id');

        filter.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { 'items.product': { $in: productIds } }
        ];
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(filter)
        .populate('items.product')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return { orders, totalPages, totalOrders };
};

export const cancelOrderService = async (userId, orderId, reason) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    const blockedStatuses = ['Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Requested', 'Return Approved', 'Return Picked', 'Partially Returned'];
    if (blockedStatuses.includes(order.orderStatus)) {
        return { success: false, message: `Order cannot be cancelled. Current status: ${order.orderStatus}`, status: 400 };
    }

    order.orderStatus = 'Cancelled';
    order.cancellationReason = reason || 'Cancelled by user';
    
    const newlyCancelledItems = [];
    order.items.forEach(item => {
        if (item.status !== 'Cancelled') {
            item.status = 'Cancelled';
            newlyCancelledItems.push(item);
        }
    });

    if (order.paymentStatus === 'Paid') {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        
        wallet.balance += order.totalAmount;
        wallet.transactions.push({
            amount: order.totalAmount,
            type: 'credit',
            description: `Refund for Cancelled Order #${order.orderId}`
        });
        await wallet.save();
        order.paymentStatus = 'Refunded';
    }

    await recalculateOrderTotals(order);
    await order.save();

    // Notification
    const user = await User.findById(userId);
    await createAdminNotification({
        type: 'order_cancelled',
        title: 'Order Cancelled',
        message: `Order #${order.orderId} has been cancelled by ${user.name || user.email}. Reason: ${order.cancellationReason}`,
        orderId: order._id
    });

    // Stock Restoration
    for (const item of newlyCancelledItems) {
        const product = await Product.findById(item.product);
        if (product) {
            product.stock += item.qty;
            if (item.variant && product.variants && product.variants.length > 0) {
                const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
                if (variantIndex > -1) {
                    product.variants[variantIndex].stock += item.qty;
                }
            }
            await product.save();
        }
    }

    return { success: true, message: 'Order cancelled successfully' };
};

export const cancelOrderItemService = async (userId, orderId, itemId) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    const blockedStatuses = ['Shipped', 'Delivered', 'Cancelled', 'Returned', 'Return Requested', 'Return Approved', 'Return Picked', 'Partially Returned'];
    if (blockedStatuses.includes(order.orderStatus)) {
        return { success: false, message: `Cannot cancel item. Order status: ${order.orderStatus}`, status: 400 };
    }

    const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) return { success: false, message: 'Item not found in order', status: 404 };

    const item = order.items[itemIndex];
    if (item.status === 'Cancelled') return { success: false, message: 'Item already cancelled', status: 400 };

    item.status = 'Cancelled';
    const refundAmount = calculateItemRefund(item, order.subtotal, order.discount);

    if (order.paymentStatus === 'Paid') {
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            description: `Refund for Cancelled Item in Order #${order.orderId}`
        });
        await wallet.save();
    }

    const product = await Product.findById(item.product);
    if (product) {
        product.stock += item.qty;
        if (item.variant && product.variants && product.variants.length > 0) {
            const variantIndex = product.variants.findIndex(v => isSameVariant(v, item.variant));
            if (variantIndex > -1) {
                product.variants[variantIndex].stock += item.qty;
            }
        }
        await product.save();
    }

    const allCancelled = order.items.every(item => item.status === 'Cancelled');
    if (allCancelled) {
        order.orderStatus = 'Cancelled';
        order.cancellationReason = 'All items cancelled individually';
        if (order.paymentStatus === 'Paid') order.paymentStatus = 'Refunded';
    }

    await recalculateOrderTotals(order);
    await order.save();
    return { success: true, message: 'Item cancelled successfully and refund processed to wallet.' };
};

export const requestReturnService = async (userId, orderId, reason) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    if (order.orderStatus !== 'Delivered') {
        return { success: false, message: 'Only delivered orders can be returned.', status: 400 };
    }

    order.orderStatus = 'Return Requested';
    order.returnReason = reason;

    order.items.forEach(item => {
        if (item.status === 'Delivered') {
            item.status = 'Return Requested';
            item.returnReason = reason;
        }
    });

    await order.save();

    const user = await User.findById(userId);
    await createAdminNotification({
        type: 'return_requested',
        title: 'Return Requested',
        message: `A full return has been requested for Order #${order.orderId} by ${user.name || user.email}. Reason: ${reason}`,
        orderId: order._id
    });

    return { success: true, message: 'Return request submitted successfully.' };
};

export const returnOrderItemService = async (userId, orderId, itemId, reason) => {
    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    if (order.orderStatus !== 'Delivered' && order.orderStatus !== 'Partially Returned') {
        return { success: false, message: 'Returns can only be requested for delivered orders.', status: 400 };
    }

    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) return { success: false, message: 'Item not found', status: 404 };

    if (item.status !== 'Delivered') {
        return { success: false, message: `Item cannot be returned. Status: ${item.status}`, status: 400 };
    }

    item.status = 'Return Requested';
    item.returnReason = reason;

    if (order.orderStatus === 'Delivered' || order.orderStatus === 'Partially Returned') {
        order.orderStatus = 'Return Requested';
    }

    await order.save();

    const user = await User.findById(userId);
    await createAdminNotification({
        type: 'return_requested',
        title: 'Partial Return Requested',
        message: `User ${user.name || user.email} requested a return for an item in Order #${order.orderId}. Reason: ${reason}`,
        orderId: order._id
    });

    return { success: true, message: 'Return request for the item submitted successfully.' };
};
