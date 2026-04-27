import User from '../../models/user/User.js';
import bcrypt from 'bcryptjs';

export const getSettings = async (req, res) => {
    try {
        const adminId = req.session.admin._id;
        const admin = await User.findById(adminId).select('-password').lean();

        if (!admin) {
            return res.redirect('/admin/login');
        }

        res.render('admin/settings/general', {
            title: 'Settings',
            admin,
            breadcrumbs: [
                { label: 'Dashboard', url: '/admin/dashboard' },
                { label: 'Settings', url: '/admin/settings/general' }
            ]
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.redirect('/admin/dashboard?msg=Failed to load settings&icon=error');
    }
};

export const updateProfile = async (req, res) => {
    try {
        const adminId = req.session.admin._id;
        const { firstName, lastName, email, phone } = req.body;

        if (!firstName || !email) {
            return res.status(400).json({ success: false, message: 'First name and email are required.' });
        }

        const emailExists = await User.findOne({ email, _id: { $ne: adminId } });
        if (emailExists) {
            return res.status(400).json({ success: false, message: 'Email is already in use by another account.' });
        }

        await User.findByIdAndUpdate(adminId, {
            firstName: firstName.trim(),
            lastName: (lastName || '').trim(),
            email: email.trim().toLowerCase(),
            phone: (phone || '').trim()
        });

        // Update session email
        req.session.admin.email = email.trim().toLowerCase();

        res.json({ success: true, message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating admin profile:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

export const changePassword = async (req, res) => {
    try {
        const adminId = req.session.admin._id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All password fields are required.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'New passwords do not match.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const admin = await User.findById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        admin.password = hashed;
        await admin.save();

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Error changing admin password:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};
