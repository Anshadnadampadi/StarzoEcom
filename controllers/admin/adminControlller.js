import admin from '../../models/admin/admin.js';
import User from '../../models/user/User.js';
import Address from '../../models/user/Address.js';
import Order from '../../models/order/order.js';
import Product from '../../models/product/product.js';
import Category from '../../models/category/category.js';
import bcrypt from 'bcryptjs';
import { adminLogin} from '../../services/admin/adminServices.js';
import {
    getDashboardUsersService,
    blockUserService,
    unblockUserService,
    deleteUserService,
    editUserService 
} from '../../services/admin/adminServices.js';


export const getAdminLogin = (req, res) => {

    
    if (req.session && req.session.admin) {
        return res.redirect('/admin/dashboard');
    }

    const { msg, icon } = req.query;

    res.render('admin/auth/login', {
        title: 'Admin Login',
        error: null,
        layout: false,
        msg: msg || null,
        icon: icon || null
    });
};

export const postAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await adminLogin({ email, password });

    if (!result.success) {
      return res.render("admin/auth/login", {
        title: "Admin Login",
        error: result.message,
        layout: false
      });
    }

    // Create admin session
    req.session.admin = {
      _id: result.admin._id,
      email: result.admin.email,
      role: "admin"
    };

    // Explicitly save session before redirect to guarantee persistence
    req.session.save((err) => {
      if (err) {
        console.error("[ADMIN LOGIN] Session save failure:", err);
        return res.status(500).render("admin/auth/login", {
          title: "Admin Login",
          error: "Session initialization failed. Please try again.",
          layout: false
        });
      }
      return res.redirect("/admin/dashboard");
    });

  } catch (error) {
    console.log(error);
    return res.status(500).render("admin/auth/login", {
      title: "Admin Login",
      error: "Server error",
      layout: false
    });
  }
};

export const getAdminDashboard = async (req, res) => {
    try {
        const activeStatuses = ['Pending', 'Delivered', 'Shipped', 'Processing', 'Confirmed', 'Return Requested', 'Return Approved', 'Return Picked', 'Partially Returned'];

        const [ordersStats, totalCustomers, topProducts, topCategories, topBrands, orderStatusStats, inventoryStats, recentOrders] = await Promise.all([
            Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses } } },
                { 
                    $group: { 
                        _id: null, 
                        totalRevenue: { $sum: "$totalAmount" },
                        totalOrders: { $sum: 1 }
                    } 
                }
            ]),
            User.countDocuments({ isAdmin: false }),
            // Top 10 Best Selling Products with images
            Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses } } },
                { $unwind: "$items" },
                { $group: { _id: "$items.product", totalSold: { $sum: "$items.qty" } } },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "products",
                        localField: "_id",
                        foreignField: "_id",
                        as: "productInfo"
                    }
                },
                { $unwind: "$productInfo" },
                { 
                    $project: { 
                        name: "$productInfo.name", 
                        image: { $arrayElemAt: ["$productInfo.images", 0] },
                        totalSold: 1 
                    } 
                }
            ]),
            // Top 10 Best Selling Categories
            Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses } } },
                { $unwind: "$items" },
                {
                    $lookup: {
                        from: "products",
                        localField: "items.product",
                        foreignField: "_id",
                        as: "productInfo"
                    }
                },
                { $unwind: "$productInfo" },
                { $group: { _id: "$productInfo.category", totalSold: { $sum: "$items.qty" } } },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "categories",
                        localField: "_id",
                        foreignField: "_id",
                        as: "categoryInfo"
                    }
                },
                { $unwind: "$categoryInfo" },
                { $project: { name: "$categoryInfo.name", totalSold: 1 } }
            ]),
            // Top 10 Best Selling Brands
            Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses } } },
                { $unwind: "$items" },
                {
                    $lookup: {
                        from: "products",
                        localField: "items.product",
                        foreignField: "_id",
                        as: "productInfo"
                    }
                },
                { $unwind: "$productInfo" },
                { $group: { _id: "$productInfo.brand", totalSold: { $sum: "$items.qty" } } },
                { $sort: { totalSold: -1 } },
                { $limit: 10 },
                { $project: { name: "$_id", totalSold: 1 } }
            ]),
            // Order Status Distribution
            Order.aggregate([
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } }
            ]),
            // Inventory Alerts
            Product.aggregate([
                { $unwind: "$variants" },
                { $match: { "variants.isDeleted": false } },
                {
                    $group: {
                        _id: null,
                        outOfStock: { $sum: { $cond: [{ $eq: ["$variants.stock", 0] }, 1, 0] } },
                        lowStock: { $sum: { $cond: [{ $and: [{ $gt: ["$variants.stock", 0] }, { $lt: ["$variants.stock", 5] }] }, 1, 0] } }
                    }
                }
            ]),
            // Recent Orders
            Order.find({})
                .populate('user', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(10)
        ]);

        const totalRevenue = ordersStats.length > 0 ? ordersStats[0].totalRevenue : 0;
        const totalOrders = ordersStats.length > 0 ? ordersStats[0].totalOrders : 0;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Process status stats
        const statusMap = {
            Delivered: 0,
            Pending: 0,
            Cancelled: 0,
            Returned: 0
        };

        orderStatusStats.forEach(s => {
            if (s._id === 'Delivered') statusMap.Delivered += s.count;
            else if (['Pending', 'Confirmed', 'Processing', 'Shipped'].includes(s._id)) statusMap.Pending += s.count;
            else if (s._id === 'Cancelled') statusMap.Cancelled += s.count;
            else if (['Returned', 'Partially Returned', 'Return Approved'].includes(s._id)) statusMap.Returned += s.count;
        });

        const stats = {
            revenue: { total: totalRevenue },
            orders: { total: totalOrders },
            customers: { total: totalCustomers },
            aov: avgOrderValue,
            topProducts,
            topCategories,
            topBrands,
            orderStatus: statusMap,
            inventory: inventoryStats.length > 0 ? inventoryStats[0] : { outOfStock: 0, lowStock: 0 },
            recentOrders,
            recentActivity: [
                { title: 'New Order #8829', time: '2 mins ago', desc: 'Iphone 15 Pro Max - ₹1,44,900' },
                { title: 'Customer Signup', time: '15 mins ago', desc: 'New user joined: sarath@example.com' },
                { title: 'Stock Alert', time: '1 hour ago', desc: 'Samsung Galaxy S24 Ultra low on stock' },
                { title: 'Refund Processed', time: '3 hours ago', desc: 'Order #8812 - ₹65,200 returned' }
            ]
        };

        const { msg, icon } = req.query;
        res.render('admin/dashboard', { 
            title: 'Admin Dashboard', 
            stats, 
            breadcrumbs: [
                { label: 'Dashboard', url: '/admin/dashboard' }
            ],
            msg: msg || null, 
            icon: icon || null 
        });
    } catch (error) {
        console.error('Error fetching admin dashboard stats:', error);
        res.status(500).send("Server Error");
    }
};

export const getChartData = async (req, res) => {
    try {
        const { filter = 'monthly', startDate, endDate } = req.query;
        let labels = [];
        let data = [];

        // Common status filter for revenue
        const activeStatuses = ['Pending', 'Delivered', 'Shipped', 'Processing', 'Confirmed', 'Return Requested', 'Return Approved', 'Return Picked', 'Partially Returned'];

        if (filter === 'yearly') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentYear = new Date().getFullYear();
            const monthlyData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: new Date(currentYear, 0, 1) } } },
                { $group: { _id: { $month: { date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } },
                { $sort: { "_id": 1 } }
            ]);
            labels = months;
            data = new Array(12).fill(0);
            monthlyData.forEach(d => { data[d._id - 1] = d.total; });
        } else if (filter === 'monthly') {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const monthlyData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: startOfMonth } } },
                { $group: { _id: { $dayOfMonth: { date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } },
                { $sort: { "_id": 1 } }
            ]);
            labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
            data = new Array(daysInMonth).fill(0);
            monthlyData.forEach(d => { data[d._id - 1] = d.total; });
        } else if (filter === 'weekly' || filter === '30days') {
            const daysCount = filter === 'weekly' ? 7 : 30;
            const now = new Date();
            now.setHours(23, 59, 59, 999);
            const start = new Date(now);
            start.setDate(now.getDate() - (daysCount - 1));
            start.setHours(0, 0, 0, 0);

            const dbData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: start, $lte: now } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } },
                { $sort: { "_id": 1 } }
            ]);

            // Fill all days with 0 by default
            for (let i = 0; i < daysCount; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                
                const found = dbData.find(item => item._id === dateStr);
                data.push(found ? found.total : 0);
            }
        } else if (filter === 'daily') {
            const now = new Date();
            // Calculate start of day in IST (UTC+5:30)
            const istOffset = 5.5 * 60 * 60 * 1000;
            const istNow = new Date(now.getTime() + istOffset);
            istNow.setUTCHours(0, 0, 0, 0);
            const startOfDay = new Date(istNow.getTime() - istOffset);

            const dailyData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: startOfDay } } },
                { $group: { _id: { $hour: { date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } },
                { $sort: { "_id": 1 } }
            ]);
            labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            data = new Array(24).fill(0);
            dailyData.forEach(d => { data[d._id] = d.total; });
        } else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const customData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: start, $lte: end } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } },
                { $sort: { "_id": 1 } }
            ]);

            for (let i = 0; i <= diffDays; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(dateStr);
                const found = customData.find(item => item._id === dateStr);
                data.push(found ? found.total : 0);
            }
        } else { // Default fallback (30 days)
            const daysCount = 30;
            const now = new Date();
            const start = new Date();
            start.setDate(now.getDate() - (daysCount - 1));
            start.setHours(0,0,0,0);

            const dbData = await Order.aggregate([
                { $match: { orderStatus: { $in: activeStatuses }, createdAt: { $gte: start } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } }, total: { $sum: "$totalAmount" } } }
            ]);

            for (let i = 0; i < daysCount; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                const found = dbData.find(item => item._id === dateStr);
                data.push(found ? found.total : 0);
            }
        }

        res.json({ success: true, labels, data });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const getAdminManagement = async (req, res) => {
    try {
        const { msg, icon } = req.query;
        const rawSearch = typeof req.query.search === 'string' ? req.query.search : '';
        const rawStatus = typeof req.query.status === 'string' ? req.query.status : '';

        const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
        const sortOrder = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : 'desc';

        const pageQuery = parseInt(req.query.page, 10);
        const limitQuery = parseInt(req.query.limit, 10);
        
        const page = Number.isFinite(pageQuery) && pageQuery > 0 ? pageQuery : 1;
        const limit = Number.isFinite(limitQuery) && limitQuery > 0 ? limitQuery : 4;
        const search = rawSearch.trim();
        const status = rawStatus === 'active' || rawStatus === 'blocked' ? rawStatus : '';

        if (req.query.clear === '1') {
            const clearParams = new URLSearchParams();
            if (status) clearParams.set('status', status);
            clearParams.set('page', '1');
            clearParams.set('limit', String(limit));
            return res.redirect(`/admin/customers?${clearParams.toString()}`);
        }

        const data = await getDashboardUsersService(
            search,
            page,
            limit,
            status,
            sortBy,
            sortOrder
        );

        // Build query string for pagination
        const queryParams = new URLSearchParams();
        if (search) queryParams.set('search', search);
        if (status) queryParams.set('status', status);
        if (sortBy) queryParams.set('sortBy', sortBy);
        if (sortOrder) queryParams.set('sortOrder', sortOrder);
        const queryString = queryParams.toString();

        const clearParams = new URLSearchParams();
        if (status) clearParams.set('status', status);
        clearParams.set('page', '1');
        clearParams.set('limit', String(limit));
        const clearSearchUrl = `/admin/customers?${clearParams.toString()}`;

        res.render('admin/customers', {
            title: 'Customers',
            msg,
            icon,
            customers: data.users,
            currentPage: page,
            totalPages: data.totalPages,
            limit,
            totalUsers: data.totalUsers,
            search,
            status,
            sortBy,
            sortOrder,
            query: queryString,
            breadcrumbs: [
                { label: 'Customers', url: '/admin/customers' }
            ],
            clearSearchUrl
        });

    } catch (error) {
        console.log(error);
        res.redirect('/admin/customers?msg=Session Error&icon=error');
    }
};

export const postBlock = async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`[ACL COMMAND] Admin initiating block for User ID: ${id}`);
        const result = await blockUserService(id);
        
        if (!result.success) {
            if (req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, message: "Could not restrict user." });
            }
            return res.redirect("/admin/customers?msg=Error blocking user&icon=error");
        }

        if (req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: "User identity has been restricted." });
        }
        res.redirect("/admin/customers?msg=User blocked&icon=success");
    } catch (err) {
        console.log(err);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: "Protocol failure: Could not restrict user." });
        }
        res.redirect("/admin/customers?msg=Error blocking user&icon=error");
    }
};

export const postUnblock = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await unblockUserService(id);

        if (!result.success) {
            if (req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, message: "Could not restore user." });
            }
            return res.redirect("/admin/customers?msg=Error unblocking user&icon=error");
        }

        if (req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: "User identity has been restored." });
        }
        res.redirect("/admin/customers?msg=User unblocked&icon=success");
    } catch (err) {
        console.log(err);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: "Protocol failure: Could not restore user." });
        }
        res.redirect("/admin/customers?msg=Error unblocking user&icon=error");
    }
};

export const postDelete = async (req, res) => {
    try {
        const result = await deleteUserService(req.params.id);
        if (!result.success) {
            if (req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, message: result.message || 'Invalid User' });
            }
            return res.redirect('/admin/management?msg=Invalid User&icon=error');
        }
        
        if (req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: "User record purged from matrix." });
        }
        res.redirect('/admin/customers?msg=User Deleted Successfully&icon=success');
    } catch (error) {
        console.log(error);
        if (req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, message: "Internal record failure." });
        }
        res.redirect('/admin/customers?msg=Delete Failed&icon=error');
    }
};

export const postEdit = async (req, res) => {
    const { name, email, id } = req.body;
    const result = await editUserService(id, name, email);
    if (!result.success) {
        return res.redirect('/admin/management?msg=Invalid User&icon=error');
    }
    res.redirect('/admin/customers?msg=User Edit Successfully&icon=success');
};

export const adminLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Admin logout session destruction error:", err);
        res.clearCookie("adminSid", { path: '/admin' });
        res.redirect("/admin/login");
    });
};







