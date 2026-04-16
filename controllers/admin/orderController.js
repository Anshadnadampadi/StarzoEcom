import mongoose from 'mongoose';
import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';

export const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const filter = {};
        if (search) {
            // Find users matching search to filter orders by user
            const users = await mongoose.model('User').find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = users.map(u => u._id);

            filter.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { paymentStatus: { $regex: search, $options: 'i' } },
                { orderStatus: { $regex: search, $options: 'i' } },
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

        // Calculate stats for the view
        const stats = {
            pending: await Order.countDocuments({ orderStatus: 'Pending' }),
            processing: await Order.countDocuments({ orderStatus: { $in: ['Confirmed', 'Processing'] } }),
            shipped: await Order.countDocuments({ orderStatus: 'Shipped' })
        };

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
            query: search ? `search=${search}` : '',
            breadcrumbs: [
                { label: 'Dashboard', url: '/admin/dashboard' },
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
            .populate('items.product')
            .lean();

        if (!order) {
            return res.status(404).render('errors/error', { message: 'Order not found' });
        }

        res.render('admin/order-details', {
            title: `Order #${order.orderId}`,
            order,
            breadcrumbs: [
                { label: 'Dashboard', url: '/admin/dashboard' },
                { label: 'Orders', url: '/admin/orders' },
                { label: `Order #${order.orderId}`, url: `/admin/orders/${order._id}` }
            ]
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('errors/error', { message: 'Internal Server Error' });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const oldStatus = order.orderStatus;
        order.orderStatus = status;
        
        // Auto-update payment status if delivered
        if (status === 'Delivered' && order.paymentMethod === 'CASH ON DELIVERY') {
            order.paymentStatus = 'Paid';
        }

        // Increment stock if order is cancelled or returned
        const cancelStatuses = ['Cancelled', 'Returned'];
        if (cancelStatuses.includes(status) && !cancelStatuses.includes(oldStatus)) {
            // Handle Refund if it was a final return
            if (status === 'Returned') {
                order.paymentStatus = 'Refunded';
            }

            for (const item of order.items) {
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
        }

        await order.save();
        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
