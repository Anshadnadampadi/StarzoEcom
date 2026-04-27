import Order from '../../models/order/order.js';

export const getSalesReportService = async (filter, startDate, endDate, page = null, limit = null) => {
    let matchCondition = { orderStatus: 'Delivered' }; // Sales usually count delivered orders

    const now = new Date();
    let start, end;

    if (filter === 'daily') {
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
    } else if (filter === 'weekly') {
        const firstDay = now.getDate() - now.getDay();
        const tempStart = new Date(now);
        tempStart.setDate(firstDay);
        tempStart.setHours(0, 0, 0, 0);
        start = tempStart;
        end = new Date();
    } else if (filter === 'monthly') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (filter === 'yearly') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (filter === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    } else {
        // Fallback to daily if filter is invalid or missing
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
    }

    if (start && end) {
        matchCondition.createdAt = { $gte: start, $lte: end };
    }

    // Previous Period calculation
    const duration = (start && end) ? (end.getTime() - start.getTime()) : 0;
    const prevStart = start ? new Date(start.getTime() - duration - 1) : new Date();
    const prevEnd = start ? new Date(start.getTime() - 1) : new Date();
    const prevMatchCondition = { ...matchCondition, createdAt: { $gte: prevStart, $lte: prevEnd } };

    let ordersQuery = Order.find(matchCondition)
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (parseInt(page) - 1) * parseInt(limit);
        ordersQuery = ordersQuery.skip(skip).limit(parseInt(limit));
    }

    const [orders, totalOrders, stats, prevStats, couponUsage] = await Promise.all([
        ordersQuery,
        Order.countDocuments(matchCondition),
        Order.aggregate([
            { $match: matchCondition },
            { $unwind: "$items" },
            {
                $group: {
                    _id: null,
                    totalSales: { $addToSet: "$_id" }, // Count unique orders
                    totalRevenue: { $sum: "$totalAmount" },
                    totalDiscount: { $sum: "$discount" },
                    totalProductsSold: { $sum: "$items.qty" }
                }
            },
            {
                $project: {
                    totalSales: { $size: "$totalSales" },
                    totalRevenue: 1,
                    totalDiscount: 1,
                    totalProductsSold: 1
                }
            }
        ]),
        Order.aggregate([
            { $match: prevMatchCondition },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" }
                }
            }
        ]),
        Order.aggregate([
            { $match: { ...matchCondition, couponCode: { $ne: null } } },
            {
                $group: {
                    _id: "$couponCode",
                    timesUsed: { $sum: 1 },
                    totalDiscount: { $sum: "$discount" }
                }
            },
            { $sort: { timesUsed: -1 } },
            { $limit: 5 }
        ])
    ]);

    const reportStats = stats.length > 0 ? stats[0] : { totalSales: 0, totalRevenue: 0, totalDiscount: 0, totalProductsSold: 0 };
    const previousRevenue = prevStats.length > 0 ? prevStats[0].totalRevenue : 0;

    return {
        orders,
        stats: reportStats,
        previousRevenue,
        couponUsage,
        period: { start, end },
        totalPages: limit ? Math.ceil(totalOrders / limit) : 1,
        totalOrders,
        currentPage: page ? parseInt(page) : 1
    };
};
