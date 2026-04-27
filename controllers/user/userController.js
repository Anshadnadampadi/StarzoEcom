import User from "../../models/user/User.js";
import Address from "../../models/user/Address.js";
import Order from "../../models/order/order.js";
import bcrypt from "bcryptjs";
import Wallet from "../../models/user/Wallet.js";
import { registerValidate, addressValidate } from "../../validation/user/userValidation.js";
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,30}$/;
import { registerUser, loginUser, updateUserProfile, changeUserPassword, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress, validateAndNormalizeAddress, generateReferralCode } from "../../services/user/authServices.js";
import { sendOtpService, verifyOtpService, forgotPasswordService, resendOtpService, requestEmailChangeOtpService, verifyEmailChangeOtpService } from "../../services/user/authServices.js";
import product from "../../models/product/product.js";


export const getHome = async (req, res) => {
    try {
        const { msg, icon } = req.query;
        res.render("user/home", { msg: msg || null, icon: icon || null });
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};


export const getSignup = (req, res) => {
    const { msg, icon } = req.query;
    res.render("user/auth/register", {
        breadcrumbs: [
            { label: 'Register', url: '/auth/signup' }
        ],
        msg: msg || null,
        icon: icon || null
    });
};


export const postSignup = async (req, res) => {
    try {
        
        const { error } = registerValidate.validate(req.body);
        if (error) {
            return res.json({
                success: false,
                message: error.details[0].message
            });
        }

        const { firstName, lastName, email, password } = req.body;
        const result = await sendOtpService({ firstName, lastName, email, password });

        if (!result.success) {
            return res.json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            redirect: `/auth/verify-otp?email=${encodeURIComponent(result.email)}`
        });

    } catch (error) {
        console.error("Signup Controller Error:", error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
};
export const getForgotPassword = (req, res) => {
    const { msg, icon } = req.query;
    res.render("user/auth/forgotPassword", { msg: msg || null, icon: icon || null });
};

// handle submission of the forgot-password form
export const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await forgotPasswordService(email);
        if (!result.success) {
            return res.json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            redirect: `/auth/verify-otp?email=${encodeURIComponent(email)}&context=reset`
        });
    } catch (err) {
        console.error("Forgot password controller error", err);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const getlogin = (req, res) => {

    const { msg, icon, error } = req.query;

    let message = null;

    if (error === "blocked") {
        message = "Your account has been blocked by admin.";
    }

    res.render("user/auth/login", {
        breadcrumbs: [
            { label: 'Login', url: '/auth/login' }
        ],
        msg,
        icon,
        message
    });

};

export const postLogin = async (req, res) => {
    try {

        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'All fields required' });
        }

        email = String(email || '').trim().toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'Your account is blocked' });
        }

        req.session.user = user._id;

        return res.json({ success: true, redirect: '/' });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};


export const emailVerify = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const result = await sendOtpService(req.body);

        if (!result.success) {
            return res.json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            redirect: `/auth/verify-otp?email=${result.email}`
        });
    } catch (error) {
        console.error("Email verify error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const resendOtp = async (req, res) => {
    const { email, context } = req.query;
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('json'));

    if (!email) {
        return isAjax ? res.json({ success: false, message: 'Email required' }) : res.redirect('/');
    }
    // choose service based on context; reset flow uses forgotPasswordService while signup uses resendOtpService
    let result;
    if (context === 'reset') {
        result = await forgotPasswordService(email);
    } else {
        result = await resendOtpService(email);
    }

    if (isAjax) {
        return res.json(result);
    }

    if (!result.success) {
        return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}${context ? `&context=${context}` : ''}&msg=${encodeURIComponent(result.message)}&icon=error`);
    }
    res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}${context ? `&context=${context}` : ''}`);
};

export const getOtp = (req, res) => {
    res.render("user/auth/otpVerification")
}
export const resetPassword = (req, res) => {
    res.render("user/auth/resetPassword", {
        email: req.query.email,
        msg: req.query.msg || null,
        icon: req.query.icon || null
    });
};
export const resetSuccess = (req, res) => {
    res.render("user/resetSuccess");
};

// update password submission
export const postResetPassword = async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;
        if (!email || req.session.resetEmail !== email) {
            return res.json({
                success: false,
                message: "Unauthorized or Session expired. Please try again."
            });
        }
        if (!password || !confirmPassword) {
            return res.json({
                success: false,
                message: "All fields required"
            });
        }
        if (password !== confirmPassword) {
            return res.json({
                success: false,
                message: "Passwords do not match"
            });
        }
        if (!passwordPattern.test(password)) {
            return res.json({
                success: false,
                message: "Password must contain uppercase, lowercase, number and special character and be at least 8 characters long."
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.json({
                success: false,
                message: "User not found"
            });
        }

        const hashed = await bcrypt.hash(password, 10);
        user.password = hashed;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        delete req.session.resetEmail; // Clear the authorization

        return res.json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (err) {
        console.error("Post reset password error:", err);
        return res.status(500).json({
            success: false,
            message: "Password update failed"
        });
    }
};



/* POST Signup → Send OTP */
export const otpSignup = async (req, res) => {
    try {
        const result = await sendOtpService(req.body);

        if (!result.success) {
            return res.json({
                success: false,
                message: result.message
            });
        }

        return res.json({
            success: true,
            redirect: `/auth/verify-otp?email=${result.email}`
        });
    } catch (error) {
        console.error("OTP signup error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

/* POST Verify OTP */
export const postVerifyOtp = async (req, res) => {

    const { email, otp, context } = req.body;

    const result = await verifyOtpService({ email, otp, context });

    if (!result.success) {
        return res.json({
            success: false,
            message: result.message
        });
    }

    if (context === "reset") {
        req.session.resetEmail = email; // Authorize this session to reset the password
        return res.json({
            success: true,
            redirect: `/auth/reset-password?email=${encodeURIComponent(email)}`
        });
    }

    return res.json({
        success: true,
        redirect: "/auth/login"
    });

};

export const loadVerifyOtp = (req, res) => {
    const email = req.query.email
    const context = req.query.context || "signup"
    res.render("user/auth/otpVerification", {
        email,
        error: null,
        context,
    });
};

export const getProfile = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        const user = await User.findById(req.session.user).lean();
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Ensure user has a referral code (lazy sync if needed)
        if (!user.referralCode) {
            const updatedUser = await User.findById(req.session.user);
            updatedUser.referralCode = await generateReferralCode();
            await updatedUser.save();
            user.referralCode = updatedUser.referralCode;
        }

        const [ordersCount, totalSpendResult] = await Promise.all([
            Order.countDocuments({ user: user._id }),
            Order.aggregate([
                { $match: { user: user._id, orderStatus: { $ne: 'Cancelled' } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ])
        ]);

        user.totalOrders = ordersCount;
        user.totalSpend = totalSpendResult.length > 0 ? totalSpendResult[0].total : 0;

        const { msg, icon } = req.query;
        res.render("user/account/profile", {
            user,
            currentPath: req.path,
            breadcrumbs: [
                { label: 'Account', url: '/profile' },
                { label: 'Profile', url: '/profile' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (err) {
        console.error('Get profile error', err);
        res.status(500).send('Server Error');
    }
};

export const getAccountDashboard = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }
        const user = await User.findById(req.session.user).lean();
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Aggregate statistics
        const [ordersCount, totalSpendResult, recentOrders, wallet] = await Promise.all([
            Order.countDocuments({ user: user._id }),
            Order.aggregate([
                { $match: { user: user._id, orderStatus: { $ne: 'Cancelled' } } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } }
            ]),
            Order.find({ user: user._id }).sort({ createdAt: -1 }).limit(3).lean(),
            Wallet.findOne({ user: user._id }).lean()
        ]);

        user.totalOrders = ordersCount;
        user.totalSpend = totalSpendResult.length > 0 ? totalSpendResult[0].total : 0;

        const { msg, icon } = req.query;
        res.render("user/account/dashboard", {
            user,
            recentOrders,
            wallet: wallet || { balance: 0, transactions: [] },
            currentPath: '/account',
            breadcrumbs: [
                { label: 'Account', url: '/account' },
                { label: 'Dashboard', url: '/account' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (err) {
        console.error('Get account dashboard error', err);
        res.status(500).send('Server Error');
    }
};

// handle submission from profile edit modal
export const postUpdateProfile = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const result = await updateUserProfile(req.session.user, req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        // return updated user data so front-end can refresh UI if needed
        return res.json({ success: true, user: result.user });
    } catch (err) {
        console.error('Update profile controller error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// change password from profile page
export const postChangePassword = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        const { currentPw, newPw, confirmPw } = req.body;
        if (!currentPw || !newPw || !confirmPw) {
            return res.status(400).json({ success: false, message: 'All password fields required' });
        }
        if (newPw !== confirmPw) {
            return res.status(400).json({ success: false, message: "Passwords don't match" });
        }
        if (!passwordPattern.test(newPw)) {
            return res.status(400).json({ success: false, message: "Password must contain uppercase, lowercase, number and special character and be at least 8 characters long." });
        }

        const result = await changeUserPassword(req.session.user, currentPw, newPw);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('Change password controller error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// extra standalone user page



export const getAddress = async (req, res) => {
    try {

        if (!req.session.user) return res.redirect('/auth/login');
        const user = await User.findById(req.session.user).populate('addresses').lean();
        if (!user) return res.status(404).send('User not found');

        // Pass addresses explicitly for convenience in the view
        const addresses = user.addresses || [];

        const { msg, icon } = req.query;
        res.render("user/account/addresses", {
            user,
            addresses,
            currentPath: req.path,
            breadcrumbs: [
                { label: 'Account', url: '/profile' },
                { label: 'My Addresses', url: '/addresses' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (err) {
        console.error('Get address error', err);
        res.status(500).send('Server Error');
    }
};

export const validateAddress = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { error } = addressValidate.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                errors[detail.path[0]] = detail.message;
            });
            return res.status(400).json({ success: false, message: 'Validation failed', errors });
        }

        const result = await validateAndNormalizeAddress(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({ success: true, address: result.address });

    } catch (err) {
        console.error('Validate address error', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// create new address
export const postAddress = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

        const { error } = addressValidate.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                errors[detail.path[0]] = detail.message;
            });
            return res.status(400).json({ success: false, message: 'Validation failed', errors });
        }

        const result = await addUserAddress(req.session.user, req.body);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({ success: true, address: result.address });

    } catch (err) {
        console.error('Post address error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// update existing address
export const putAddress = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const { id } = req.params;

        const { error } = addressValidate.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                errors[detail.path[0]] = detail.message;
            });
            return res.status(400).json({ success: false, message: 'Validation failed', errors });
        }

        const result = await updateUserAddress(req.session.user, id, req.body);
        if (!result.success) {
            const status = result.code === 'ADDRESS_VALIDATION_UNAVAILABLE' ? 503 : 400;
            return res.status(status).json(result);
        }
        return res.json({ success: true, address: result.address });
    } catch (err) {
        console.error('Put address error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// delete address
export const deleteAddress = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const { id } = req.params;
        const result = await deleteUserAddress(req.session.user, id);
        if (!result.success) return res.status(400).json(result);
        return res.json({ success: true });
    } catch (err) {
        console.error('Delete address error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// set default address
export const patchDefaultAddress = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        const { id } = req.params;
        const result = await setDefaultAddress(req.session.user, id);
        if (!result.success) return res.status(400).json(result);
        return res.json({ success: true });
    } catch (err) {
        console.error('Patch default address error', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
export const geteditProfile = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const user = await User.findById(req.session.user).lean();
        if (!user) return res.status(404).send('User not found');
        const msg = req.query.error || req.query.success || '';
        const icon = req.query.error ? 'error' : (req.query.success ? 'success' : '');
        res.render("user/editProfile", {
            user,
            currentPath: req.path,
            breadcrumbs: [
                { label: 'Account', url: '/profile' },
                { label: 'Edit Profile', url: '/editProfile' }
            ],
            msg,
            icon
        });
    } catch (err) {
        console.error('Get edit profile error', err);
        res.status(500).send('Server Error');
    }
};

export const postEditProfile = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect('/auth/login');
        const result = await updateUserProfile(req.session.user, req.body);
        if (!result.success) {
            return res.redirect('/editProfile?error=' + encodeURIComponent(result.message));
        }

        if (req.file) {
            const imageUrl = req.file.path;
            result.user.profileImage = imageUrl;
            result.user.avatar = imageUrl; // keep legacy field in sync
            await result.user.save();
        }

        return res.redirect('/profile');
    } catch (err) {
        console.error('Post edit profile error', err);
        res.status(500).send('Server Error');
    }
};

export const updateProfileImage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No image uploaded" });
        }

        const userId = req.session.user
        const imagePath = req.file.path

        await User.findByIdAndUpdate(userId, {
            profileImage: imagePath,
            avatar: imagePath
        })
        return res.json({ success: true, imageUrl: imagePath })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

export const removeProfileImage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        const defaultImage = "/images/default-avatar.png";
        await User.findByIdAndUpdate(req.session.user, {
            profileImage: defaultImage,
            avatar: defaultImage
        });

        return res.json({ success: true, imageUrl: defaultImage });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("User logout session destruction error:", err);
        res.clearCookie("userSid", { path: '/' });
        res.redirect('/');
    });
};
export const updateProfile = async (req, res) => {

    try {
        const userId = req.session.user;

        let updateData = {
            name: req.body.fullName,
            displayName: req.body.displayName,
            phone: req.body.phone,
            dob: req.body.dob,
            location: req.body.location,
            bio: req.body.bio
        };

        if (req.file) {
            updateData.profileImage = "/uploads/profile/" + req.file.filename;
        }

        if (Object.keys(updateData).length === 0) {
            return res.redirect("/profile?msg=No changes made&icon=info");
        }


        await User.findByIdAndUpdate(userId, updateData);

        return res.redirect("/profile?msg=Profile updated successfully&icon=success");
    } catch (error) {
        console.log("profile Update error", error)
        res.redirect("/profile?msg=Something Went Wrong&icon=error")
    }
};

export const requestEmailChangeOtp = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const { email } = req.body;
        const result = await requestEmailChangeOtpService({
            userId: req.session.user,
            newEmail: email
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        req.session.emailChange = {
            newEmail: result.email,
            otp: result.otp,
            otpExpiry: result.otpExpiry
        };

        return res.json({
            success: true,
            message: 'OTP sent to your new email address'
        });
    } catch (error) {
        console.error('Request email change OTP controller error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const verifyAndActivateEmailChange = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const pending = req.session.emailChange;
        if (!pending) {
            return res.status(400).json({ success: false, message: 'No pending email change found' });
        }

        const { otp } = req.body;
        const result = await verifyEmailChangeOtpService({
            userId: req.session.user,
            pendingEmail: pending.newEmail,
            enteredOtp: otp,
            expectedOtp: pending.otp,
            otpExpiry: pending.otpExpiry
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        delete req.session.emailChange;

        return res.json({
            success: true,
            email: result.email,
            message: 'Email updated and verified successfully'
        });
    } catch (error) {
        console.error('Verify email change OTP controller error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


