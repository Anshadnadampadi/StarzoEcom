import Order from '../../models/order/order.js';
import { 
    getOrdersService, 
    updateOrderStatusService, 
    updateItemReturnStatusService,
    updateItemStatusService,
    syncOrderStatus
} from '../../services/admin/orderService.js';

export const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Increased limit for better view
        const search = req.query.search || '';
        const status = req.query.status || '';

        const { orders, stats, totalPages } = await getOrdersService(search, status, page, limit);

        // Build query string for pagination
        let queryString = '';
        if (search) queryString += `search=${search}&`;
        if (status) queryString += `status=${status}&`;

        res.render('admin/orders', {
            title: 'Orders',
            orders,
            stats,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            search,
            status,
            query: queryString,
            breadcrumbs: [
                { label: 'Orders', url: '/admin/orders' }
            ]
        });
    } catch (error) {
        console.error('Error fetching admin orders:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate('user', 'firstName lastName name email')
            .populate('items.product');

        if (!order) {
            return res.status(404).render('errors/error', { message: 'Order not found' });
        }

        // Self-healing: Sync status if out of sync
        const originalStatus = order.orderStatus;
        syncOrderStatus(order);
        if (order.orderStatus !== originalStatus) {
            await order.save();
        }

        const orderData = order.toObject(); // Use toObject for the view

        res.render('admin/order-details', {
            title: `Order #${orderData.orderId}`,
            order: orderData,
            breadcrumbs: [
                { label: 'Orders', url: '/admin/orders' },
                { label: `Order #${order.orderId}`, url: `/admin/orders/${order._id}` }
            ]
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

import { sendUserNotification } from "../../utils/notificationHelper.js";

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const result = await updateOrderStatusService(orderId, status);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        // Notify User in real-time
        const order = await Order.findById(orderId).select('user orderId');
        if (order) {
            await sendUserNotification(order.user, {
                type: 'order_status',
                title: 'Order Update',
                message: `Your order #${order.orderId} is now ${status}`,
                orderId: orderId,
                status: status
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const updateItemReturnStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;
        const result = await updateItemReturnStatusService(orderId, itemId, status);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error updating item return status:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const updateItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;
        const result = await updateItemStatusService(orderId, itemId, status);

        if (!result.success) {
            return res.status(result.status || 400).json(result);
        }

        // Notify User
        const order = await Order.findById(orderId).populate('items.product').select('user orderId items');
        if (order) {
            const item = order.items.find(i => i._id.toString() === itemId);
            const productName = item && item.product ? item.product.name : 'an item';
            
            await sendUserNotification(order.user, {
                type: 'order_status',
                title: 'Item Update',
                message: `Product "${productName}" in your order #${order.orderId} is now ${status}`,
                orderId: orderId,
                status: status
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
