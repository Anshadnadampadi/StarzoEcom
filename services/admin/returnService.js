import mongoose from 'mongoose';
import Order from '../../models/order/order.js';

export const getReturnsService = async (search, status, page, limit) => {
    const skip = (page - 1) * limit;
    
    // Base filter for return-related orders
    const returnStatuses = ['Return Requested', 'Return Approved', 'Return Picked', 'Returned', 'Return Rejected', 'Partially Returned'];
    const filter = {
        orderStatus: { $in: returnStatuses }
    };
    
    // Status Filter (within return statuses)
    if (status && status !== 'all' && returnStatuses.includes(status)) {
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

        filter.$and = [
            { orderStatus: { $in: returnStatuses } }, // Re-enforce base filter
            {
                $or: [
                    { orderId: { $regex: search, $options: 'i' } },
                    { 'items.product': { $in: productIds } },
                    { user: { $in: userIds } }
                ]
            }
        ];
    }

    const totalReturns = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalReturns / limit);

    const returns = await Order.find(filter)
        .populate('user', 'firstName lastName name email')
        .sort({ updatedAt: -1 }) // Show most recent updates first
        .skip(skip)
        .limit(limit)
        .lean();

    const stats = {
        requested: await Order.countDocuments({ orderStatus: 'Return Requested' }),
        approved: await Order.countDocuments({ orderStatus: 'Return Approved' }),
        picked: await Order.countDocuments({ orderStatus: 'Return Picked' }),
        completed: await Order.countDocuments({ orderStatus: 'Returned' })
    };

    return { returns, stats, totalPages, totalReturns };
};
