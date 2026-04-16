import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';

export const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('user/account/orders', {
            title: 'My Orders',
            orders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            lastPage: totalPages,
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Profile', url: '/profile' },
                { label: 'Orders', url: '/account/orders' }
            ]
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const getUserOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('items.product')
            .lean();

        if (!order) {
            return res.status(404).render('errors/error', { message: 'Order not found' });
        }

        res.render('user/account/order-details', {
            title: `Order Details #${order.orderId}`,
            order,
            breadcrumbs: [
                { label: 'Home', url: '/' },
                { label: 'Orders', url: '/account/orders' },
                { label: `Order #${order.orderId}`, url: `/account/orders/${order._id}` }
            ]
        });
    } catch (error) {
        console.error('Error fetching user order details:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const cancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (['Shipped', 'Delivered', 'Cancelled', 'Returned'].includes(order.orderStatus)) {
            return res.status(400).json({ success: false, message: `Order cannot be cancelled. Current status: ${order.orderStatus}` });
        }

        order.orderStatus = 'Cancelled';
        order.cancellationReason = reason || 'Cancelled by user';
        
        // Handle refund if payment was made online
        if (order.paymentStatus === 'Paid') {
            // Logic for refunding to wallet or original method would go here
            // For now, just mark status
            order.paymentStatus = 'Refunded';
        }

        await order.save();

        // Restore stock
        for (const item of order.items) {
            const product = await Product.findById(item.product);
            if (product) {
                // Increment main stock
                product.stock += item.qty;

                // Handle variant stock if applicable
                if (item.variant && product.variants && product.variants.length > 0) {
                    // Item variant can be an object with properties or an ID string
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

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const requestReturn = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user;

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Please provide a detailed reason for the return (min 10 characters).' });
        }

        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });
        }

        order.orderStatus = 'Return Requested';
        order.returnReason = reason;
        await order.save();

        res.json({ success: true, message: 'Return request submitted successfully. We will review it shortly.' });
    } catch (error) {
        console.error('Error requesting return:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
