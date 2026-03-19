import admin from "../../models/admin/admin.js";
import Address from "../../models/user/Address.js";
import bcrypt from 'bcryptjs';
import dotenv from "dotenv";
dotenv.config();
import User from "../../models/user/User.js";


// services/adminService.js

export const adminLogin = async ({ email, password }) => {
    console.log('Admin')
    const admin = await User.findOne({ email, isAdmin: true });
    console.log(admin)

    if (admin) {
        const isMatch = await bcrypt.compare(password, admin.password);
        console.log(isMatch)

        if (isMatch) {
            return {
                success: true,
                message: "Login Successfully"
            };
        }
    }

    return {
        success: false,
        message: "Invalid credentials"
    };
};
export const adminLogout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Server error' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
}


// services/adminService.js




//  Admin Login
export const adminLoginService = async (email, password) => {
    const checkAdmin = await Admin.findOne({ email });


    if (!checkAdmin) {
        return { success: false, message: "No Admin Found" };
    }

    if (password !== checkAdmin.password) {
        return { success: false, message: "Invalid Password" };
    }

    return {
        success: true,
        adminId: checkAdmin._id
    };
};



//  Get Dashboard Users (Search + Pagination)
export const getDashboardUsersService = async (search, page, limit, status) => {
    try {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.max(1, Number(limit) || 4);
        const skip = (safePage - 1) * safeLimit;
        const normalizedSearch = String(search || '').trim();

        const andFilters = [{ isAdmin: false }];

        if (normalizedSearch) {
            const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            andFilters.push({
                $or: [
                    { name: { $regex: escapedSearch, $options: 'i' } },
                    { email: { $regex: escapedSearch, $options: 'i' } }
                ]
            });
        }

        if (status === "blocked") {
            andFilters.push({
                $or: [
                    { status: 0 },
                    { isBlocked: true }
                ]
            });

        } else if (status === "active") {
            andFilters.push({ status: { $ne: 0 } });
            andFilters.push({ isBlocked: { $ne: true } });
        }

        const query = { $and: andFilters };

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / safeLimit);


        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit);

            console.log(users)

        return {
            users,
            totalUsers,
            totalPages
        };

    } catch (err) {
        console.log(err);

        return {
            users: [],
            totalUsers: 0,
            totalPages: 0
        };
    }
};



// Block User
export const blockUserService = async (userId) => {
    const user = await User.findById(userId);

    if (!user) return { success: false };

    if (user.status !== 1) {
        return { success: false };
    }

    user.status = 0;
    user.isBlocked = true;
    await user.save();

    return { success: true };
};



//  Unblock User
export const unblockUserService = async (userId) => {
    const user = await User.findById(userId);

    if (!user) return { success: false };

    if (user.status !== 0) {
        return { success: false };
    }

    user.status = 1;
    user.isBlocked = false;
    await user.save();

    return { success: true };
};



// Delete User
export const deleteUserService = async (userId) => {
    const user = await User.findByIdAndDelete(userId);
    return user ? { success: true } : { success: false };
};



//  Edit User
export const editUserService = async (id, name, email) => {
    const updated = await User.findByIdAndUpdate(
        id,
        { name, email },
        { new: true }
    );

    return updated ? { success: true } : { success: false };
};

export default {
    adminLoginService,
    getDashboardUsersService,
    blockUserService,
    unblockUserService,
    deleteUserService,
    editUserService
};
