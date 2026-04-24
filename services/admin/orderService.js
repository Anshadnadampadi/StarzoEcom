import mongoose from 'mongoose';
import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';
import { isSameVariant } from '../../utils/productHelpers.js';
import { recalculateOrderTotals, calculateItemRefund } from '../../utils/orderCalculations.js';

// recalculateOrderTotals moved to utils/orderCalculations.js

export const getOrdersService = async (search, status, page, limit) => {
    const skip = (page - 1) * limit;
    const filter = {};
    
    // Status Filter
    if (status && status !== 'all') {
        filter.orderStatus = status;
    }

    if (search) {
        const User = mongoose.model('User');
        const Product = mongoose.model('Product');

        // Find users matching search
        const users = await User.find({
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        }).select('_id');
        const userIds = users.map(u => u._id);

        // Find products matching search
        const products = await Product.find({
            name: { $regex: search, $options: 'i' }
        }).select('_id');
        const productIds = products.map(p => p._id);

        filter.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { paymentStatus: { $regex: search, $options: 'i' } },
            { 'items.product': { $in: productIds } },
            { user: { $in: userIds } }
        ];
    }

    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = (await Order.find(filter)
        .populate('user', 'firstName lastName name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()).map(o => ({ ...o, status: o.orderStatus }));

    const stats = {
        pending: await Order.countDocuments({ orderStatus: 'Pending' }),
        processing: await Order.countDocuments({ orderStatus: { $in: ['Confirmed', 'Processing'] } }),
        shipped: await Order.countDocuments({ orderStatus: 'Shipped' })
    };

    return { orders, stats, totalPages, totalOrders };
};

export const updateOrderStatusService = async (orderId, status) => {
    const order = await Order.findById(orderId);
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    const oldStatus = order.orderStatus;

    if (oldStatus === 'Cancelled' || oldStatus === 'Returned') {
        return { success: false, message: `Cannot update a ${oldStatus} order.`, status: 400 };
    }

    const statusHierarchy = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
    const oldIndex = statusHierarchy.indexOf(oldStatus);
    const newIndex = statusHierarchy.indexOf(status);

    if (oldIndex !== -1 && newIndex !== -1 && newIndex < oldIndex) {
        return { 
            success: false, 
            message: `Invalid transition: Ordered moved from ${oldStatus} to ${status} is not allowed.`,
            status: 400
        };
    }

    if (oldStatus === 'Delivered' && newIndex !== -1 && status !== 'Delivered') {
         return { success: false, message: 'Delivered orders cannot be moved back to logistics stages.', status: 400 };
    }

    order.orderStatus = status;
    const newlyTerminalItems = [];
    
    order.items.forEach(item => {
        const oldItemStatus = item.status;
        if (!['Cancelled', 'Returned'].includes(oldItemStatus)) {
            const statusMap = {
                'Confirmed': 'Ordered',
                'Processing': 'Ordered',
                'Shipped': 'Shipped',
                'Delivered': 'Delivered'
            };
            
            if (['Return Requested', 'Return Approved', 'Return Picked', 'Returned'].includes(status)) {
                if (status === 'Return Requested' && item.status === 'Delivered') {
                    item.status = 'Return Requested';
                } else if (['Return Approved', 'Return Picked'].includes(status) && item.status === 'Return Requested') {
                    item.status = 'Return Approved';
                } else if (status === 'Returned' && ['Return Approved', 'Return Picked', 'Return Requested'].includes(item.status)) {
                    item.status = 'Returned';
                }
            } else if (statusMap[status]) {
                item.status = statusMap[status];
            }

            if (item.status !== oldItemStatus && ['Cancelled', 'Returned'].includes(item.status)) {
                newlyTerminalItems.push(item);
            }
        }
    });

    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
        order.items.forEach(item => {
            if (!['Cancelled', 'Returned'].includes(item.status)) {
                item.status = 'Cancelled';
                newlyTerminalItems.push(item);
            }
        });
    }
    
    if (status === 'Delivered' && order.paymentMethod === 'CASH ON DELIVERY') {
        order.paymentStatus = 'Paid';
    }

    if (newlyTerminalItems.length > 0) {
        let totalRefund = 0;
        const isOnlinePaid = order.paymentStatus === 'Paid';

        for (const item of newlyTerminalItems) {
            if (item.status === 'Returned' || (item.status === 'Cancelled' && isOnlinePaid)) {
                totalRefund += calculateItemRefund(item, order.subtotal, order.discount);
            }

            const product = await Product.findById(item.product);
            if (product) {
                product.stock += item.qty;
                if (item.variant && product.variants && product.variants.length > 0) {
                    const variantIndex = product.variants.findIndex(v => {
                        if (typeof item.variant === 'object' && item.variant !== null) {
                            return v.color === item.variant.color && 
                                   v.storage === item.variant.storage && 
                                   v.ram === item.variant.ram;
                        }
                        return v._id.toString() === item.variant.toString();
                    });
                    if (variantIndex > -1) {
                        product.variants[variantIndex].stock += item.qty;
                    }
                }
                await product.save();
            }
        }

        if (totalRefund > 0) {
            const Wallet = mongoose.model('Wallet');
            let wallet = await Wallet.findOne({ user: order.user });
            if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });
            
            wallet.balance += totalRefund;
            wallet.transactions.push({
                amount: totalRefund,
                type: 'credit',
                description: `Refund for ${newlyTerminalItems.length} item(s) in Order #${order.orderId}`
            });
            await wallet.save();
            
            const allTerminal = order.items.every(i => ['Cancelled', 'Returned'].includes(i.status));
            if (allTerminal) {
                order.paymentStatus = 'Refunded';
            }
        }
    }

    await recalculateOrderTotals(order);
    await order.save();
    return { success: true, message: 'Order status updated successfully' };
};

export const updateItemReturnStatusService = async (orderId, itemId, status) => {
    const order = await Order.findById(orderId);
    if (!order) return { success: false, message: 'Order not found', status: 404 };

    const item = order.items.find(i => i._id.toString() === itemId);
    if (!item) return { success: false, message: 'Item not found', status: 404 };

    const oldItemStatus = item.status;
    item.status = status;

    if (status === 'Returned' && oldItemStatus !== 'Returned') {
        const refundAmount = calculateItemRefund(item, order.subtotal, order.discount);
        const Wallet = mongoose.model('Wallet');
        let wallet = await Wallet.findOne({ user: order.user });
        
        if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, transactions: [] });
        
        wallet.balance += refundAmount;
        wallet.transactions.push({
            amount: refundAmount,
            type: 'credit',
            description: `Refund for Returned Item in Order #${order.orderId}`
        });
        await wallet.save();

        const product = await Product.findById(item.product);
        if (product) {
            product.stock += item.qty;
            if (item.variant && product.variants && product.variants.length > 0) {
                const variantIndex = product.variants.findIndex(v => {
                    if (typeof item.variant === 'object' && item.variant !== null) {
                        return v.color === item.variant.color && 
                               v.storage === item.variant.storage && 
                               v.ram === item.variant.ram;
                    }
                    return v._id.toString() === item.variant.toString();
                });
                if (variantIndex > -1) {
                    product.variants[variantIndex].stock += item.qty;
                }
            }
            await product.save();
        }
    }

    const allItemsTerminal = order.items.every(i => i.status === 'Returned' || i.status === 'Cancelled');
    const anyItemReturned = order.items.some(i => i.status === 'Returned');
    const anyItemPicked = order.items.some(i => i.status === 'Return Picked');
    const anyItemRequested = order.items.some(i => i.status === 'Return Requested');
    const anyItemApproved = order.items.some(i => i.status === 'Return Approved');
    
    if (allItemsTerminal) {
        order.orderStatus = 'Returned';
        order.paymentStatus = 'Refunded';
    } else if (anyItemRequested) {
        order.orderStatus = 'Return Requested';
    } else if (anyItemApproved) {
        order.orderStatus = 'Return Approved';
    } else if (anyItemPicked) {
        order.orderStatus = 'Return Picked';
    } else if (anyItemReturned) {
        order.orderStatus = 'Partially Returned';
    } else {
        order.orderStatus = 'Delivered';
    }

    await recalculateOrderTotals(order);
    await order.save();
    return { success: true, message: `Item return status updated to ${status}.` };
};

