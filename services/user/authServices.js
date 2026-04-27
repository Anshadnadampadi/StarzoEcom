import User from "../../models/user/User.js";
import Address from "../../models/user/Address.js";
import bcrypt from "bcryptjs";
import { transporter } from "../../config/mailer.js";
import dotenv from "dotenv"
dotenv.config()

export const registerUser = async ({ firstName, lastName, email, password }) => {
    try {
        email = String(email || '').trim().toLowerCase();
        
        if (!firstName || !email || !password) {
            return { success: false, message: "All fields required" };
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return { success: false, message: "User already exists" };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = await User.create({
            firstName,
            lastName,
            name: `${firstName} ${lastName || ''}`.trim(),
            email,
            password: hashedPassword,
            otp,
            otpExpiry: Date.now() + 1 * 60 * 1000
        });

        return { success: true, email };

    } catch (error) {
        console.log("Register Error:", error);
        return { success: false, message: "Registration failed" };
    }
};

export const loginUser = async (email, password) => {

    try {
        email = String(email || '').trim().toLowerCase();
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            console.log("User not found");
            return null;
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);

        if (isMatch) {
            console.log("Login Successful");
            return existingUser;
        } else {
            console.log("Password is not Match");
            return null;
        }

    } catch (error) {
        console.log(error);
    }
};


/* Generate 6 digit OTP */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};


//    GENERATE REFERRAL CODE
export const generateReferralCode = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let isUnique = false;
    while (!isUnique) {
        code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const existing = await User.findOne({ referralCode: code });
        if (!existing) isUnique = true;
    }
    return code;
};

//    SEND OTP SERVICE

export const sendOtpService = async ({ firstName, lastName, email, password }) => {
    try {
        email = String(email || '').trim().toLowerCase();

        if (!firstName || !email || !password) {
            return { success: false, message: "All fields required" };
        }

        const existingUser = await User.findOne({ email });

        if (existingUser && existingUser.isVerified) {
            return { success: false, message: "User already exists" };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const otp = generateOTP();

        const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes


        let user;

        if (existingUser) {
            // Update existing unverified user
            existingUser.otp = otp;
            existingUser.otpExpiry = otpExpiry;
            existingUser.password = hashedPassword;
            existingUser.firstName = firstName;
            existingUser.lastName = lastName;
            existingUser.name = `${firstName} ${lastName || ''}`.trim();
            user = await existingUser.save();
        } else {
            user = await User.create({
                firstName,
                lastName,
                name: `${firstName} ${lastName || ''}`.trim(),
                email,
                password: hashedPassword,
                otp,
                otpExpiry,
                referralCode: await generateReferralCode()
            });
        }
        console.log("Before sending email...", {
            user: process.env.EMAIL_USER,
            to: email
        });

        // Send Email
        try {
            const info = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Starzo OTP Verification",
                html: `
                 <h3>Your OTP Code</h3>
                 <p>Your verification OTP is:</p>
                 <h2>${otp}</h2>
                 <p>This OTP will expire in 5 minutes.</p>
             `

            });
            console.log("the otp is ", otp);
            console.log('Mail sent successfully:', info.response);
        } catch (mailErr) {
            console.error('Error sending mail:', mailErr);
            // return failure early so caller can respond accordingly
            return { success: false, message: 'Unable to deliver OTP email', error: mailErr.message };
        }

        console.log("the otp is ", otp);

        return { success: true, email };

    } catch (error) {
        console.log("Send OTP Error:", error);
        return { success: false, message: "Failed to send OTP" };
    }
};


//    VERIFY OTP SERVICE

export const verifyOtpService = async ({ email, otp, context }) => {
    try {
        email = String(email || '').trim().toLowerCase();
        const user = await User.findOne({ email });

        if (!user) {
            return { success: false, message: "User not found" };
        }

        // if we're verifying as part of signup, make sure not already verified
        if (context !== "reset" && user.isVerified) {
            return { success: false, message: "Already verified" };
        }

        if (user.otp !== otp) {
            return { success: false, message: "Invalid OTP" };
        }

        if (user.otpExpiry < Date.now()) {
            return { success: false, message: "OTP expired" };
        }

        // only mark verified during signup flow
        if (context !== "reset") {
            user.isVerified = true;
        }
        user.otp = null;
        user.otpExpiry = null;

        await user.save();

        return { success: true, message: "Email verified successfully" };

    } catch (error) {
        console.log("Verify OTP Error:", error);
        return { success: false, message: "Verification failed" };
    }
};


export const forgotPasswordService = async (email) => {
    try {
        email = String(email || '').trim().toLowerCase();
        const user = await User.findOne({ email: email })
        if (!user) {
            return { success: false, message: "user not found" }
        }
        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + 5 * 60 * 1000;
        await user.save();
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Starzo Password Recovery OTP",
            html: `
            <h3>Password Recovery OTP</h3>
            <p>Your password recovery OTP is:</p>           
            <h2>${otp}</h2>
            <p>This OTP will expire in 5 minutes.</p>
        `
        });
        return { success: true, message: "OTP sent to your email", email: user.email }
    } catch (error) {
        console.log("Forgot Password Error:", error);
        return { success: false, message: "Failed to process forgot password" }

    }
}

// helper: update user profile data
export const updateUserProfile = async (userId, fields = {}) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };

        // whitelist we care about
        const allowed = ['fullName', 'email', 'phone', 'dob', 'displayName', 'gender', 'bio', 'location', 'website'];
        allowed.forEach(k => {
            if (fields[k] !== undefined && fields[k] !== null) {
                switch (k) {
                    case 'fullName': user.name = fields[k]; break;
                    case 'dob': user.dob = fields[k]; break;
                    default: user[k] = fields[k];
                }
            }
        });

        if (fields.profileImage) {
            user.profileImage = fields.profileImage;
        }

        await user.save();


        return { success: true, message: 'profile updated successfuly', user };
    } catch (error) {
        console.log('Update profile error:', error);
        return { success: false, message: 'Failed to update profile' };
    }
};

// helper: change existing password
export const changeUserPassword = async (userId, currentPw, newPw) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };

        const isMatch = await bcrypt.compare(currentPw, user.password);
        if (!isMatch) {
            if (user.isGoogleUser) {
                return { success: false, message: 'Current password incorrect. For Google accounts, use "Forgot Password" to set one.' };
            }
            return { success: false, message: 'Current password is incorrect' };
        }

        const hashed = await bcrypt.hash(newPw, 10);
        user.password = hashed;
        await user.save();
        return { success: true };
    } catch (error) {
        console.log('Change password error:', error);
        return { success: false, message: 'Failed to change password' };
    }
};

const ADDRESS_TYPES = new Set(['Home', 'Work', 'Other']);
const cleanValue = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const validateAddressFields = (rawAddress = {}) => {
    const address = {
        type: cleanValue(rawAddress.type) || 'Home',
        name: cleanValue(rawAddress.name),
        phone: cleanValue(rawAddress.phone),
        addr1: cleanValue(rawAddress.addr1),
        addr2: cleanValue(rawAddress.addr2),
        city: cleanValue(rawAddress.city),
        state: cleanValue(rawAddress.state),
        zip: cleanValue(rawAddress.zip),
        country: cleanValue(rawAddress.country),
        default: rawAddress.default === true || rawAddress.default === 'true' || rawAddress.default === 'on'
    };

    const errors = {};

    if (!ADDRESS_TYPES.has(address.type)) {
        errors.type = 'Address type must be Home, Work, or Other.';
    }

    if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(address.name)) {
        errors.name = 'Full name must be 2 to 80 characters.';
    }

    const phoneDigitCount = address.phone.replace(/\D/g, '').length;
    if (!/^\+?[0-9()\-\s]{7,20}$/.test(address.phone) || phoneDigitCount < 7 || phoneDigitCount > 15) {
        errors.phone = 'Enter a valid phone number.';
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9\s,./#'()-]{2,119}$/.test(address.addr1)) {
        errors.addr1 = 'Address line 1 must be 5 to 120 characters.';
    }

    if (address.addr2 && !/^[A-Za-z0-9][A-Za-z0-9\s,./#'()-]{0,119}$/.test(address.addr2)) {
        errors.addr2 = 'Address line 2 contains invalid characters.';
    }

    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(address.city)) {
        errors.city = 'Enter a valid city name.';
    }

    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(address.state)) {
        errors.state = 'Enter a valid state or province.';
    }

    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(address.country)) {
        errors.country = 'Enter a valid country.';
    }
    if (address.country.toLowerCase() === 'other') {
        errors.country = 'Please select a supported country.';
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,10}$/.test(address.zip)) {
        errors.zip = 'Enter a valid postal code.';
    }

    if (Object.keys(errors).length > 0) {
        return {
            success: false,
            code: 'INVALID_ADDRESS_FIELDS',
            message: 'Please fix the highlighted address fields.',
            errors
        };
    }

    return { success: true, address };
};

export const validateAndNormalizeAddress = async (rawAddress = {}) => {
    const fieldValidation = validateAddressFields(rawAddress);
    if (!fieldValidation.success) {
        return fieldValidation;
    }

    return {
        success: true,
        address: fieldValidation.address
    };
};

// --- address management helpers ---

export const addUserAddress = async (userId, addr) => {
    try {

        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const validation = await validateAndNormalizeAddress(addr);
        if (!validation.success) return validation;

        const validatedAddress = validation.address;

        // unset previous default addresses
        if (validatedAddress.default) {

            const userAddresses = await Address.find({ _id: { $in: user.addresses } });

            for (let address of userAddresses) {
                address.default = false;
                await address.save();
            }
        }

        // create new address document
        const newAddress = new Address(validatedAddress);
        await newAddress.save();

        // push ObjectId into user
        user.addresses.push(newAddress._id);

        await user.save();

        return {
            success: true,
            address: newAddress
        };

    } catch (error) {
        console.log('Add address error:', error);
        return { success: false, message: 'Failed to add address' };
    }
};
export const updateUserAddress = async (userId, addrId, addr) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };

        // Ownership check
        if (!user.addresses.includes(addrId)) {
            return { success: false, message: 'Unauthorized access to address' };
        }

        const existing = await Address.findById(addrId);
        if (!existing) return { success: false, message: 'Address not found' };

        const validation = await validateAndNormalizeAddress(addr);
        if (!validation.success) return validation;
        const validatedAddress = validation.address;

        if (validatedAddress.default) {
            // Unset other addresses as default
            await Address.updateMany(
                { _id: { $in: user.addresses } },
                { $set: { default: false } }
            );
        }

        Object.assign(existing, validatedAddress);
        await existing.save();

        return {
            success: true,
            address: existing
        };
    } catch (error) {
        console.log('Update address error:', error);
        return { success: false, message: 'Failed to update address' };
    }
};

export const deleteUserAddress = async (userId, addrId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };

        // Ownership check
        if (!user.addresses.map(id => id.toString()).includes(addrId)) {
            return { success: false, message: 'Unauthorized access to address' };
        }

        await Address.findByIdAndDelete(addrId);

        user.addresses = user.addresses.filter(id => id.toString() !== addrId);
        await user.save();

        return { success: true };
    } catch (error) {
        console.log('Delete address error:', error);
        return { success: false, message: 'Failed to delete address' };
    }
};

export const setDefaultAddress = async (userId, addrId) => {
    try {
        const user = await User.findById(userId);
        if (!user) return { success: false, message: 'User not found' };

        // Ownership check
        if (!user.addresses.map(id => id.toString()).includes(addrId)) {
            return { success: false, message: 'Unauthorized access to address' };
        }

        // Unset all addresses for this user as default
        await Address.updateMany(
            { _id: { $in: user.addresses } },
            { $set: { default: false } }
        );

        // Set the selected address as default
        const result = await Address.findByIdAndUpdate(addrId, { $set: { default: true } }, { new: true });
        
        if (!result) return { success: false, message: 'Address not found' };

        return { success: true };
    } catch (error) {
        console.log('Set default address error:', error);
        return { success: false, message: 'Failed to set default address' };
    }
};

// resend OTP (sign‑up or reset flows)
export const requestEmailChangeOtpService = async ({ userId, newEmail }) => {
    try {
        const normalizedEmail = String(newEmail || '').trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(normalizedEmail)) {
            return { success: false, message: 'Enter a valid email address' };
        }

        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        if ((user.email || '').toLowerCase() === normalizedEmail) {
            return { success: false, message: 'New email must be different from current email' };
        }

        const existing = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: userId }
        });

        if (existing) {
            return { success: false, message: 'Email already in use' };
        }

        const otp = generateOTP();
        const otpExpiry = Date.now() + 5 * 60 * 1000;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: normalizedEmail,
            subject: 'Starzo Email Change OTP',
            html: `
                <h3>Email Change Verification</h3>
                <p>Use this OTP to confirm your new email address:</p>
                <h2>${otp}</h2>
                <p>This OTP expires in 5 minutes.</p>
            `
        });

        return {
            success: true,
            email: normalizedEmail,
            otp,
            otpExpiry
        };
    } catch (error) {
        console.log('Request email change OTP error:', error);
        return { success: false, message: 'Unable to send OTP right now' };
    }
};

export const verifyEmailChangeOtpService = async ({ userId, pendingEmail, enteredOtp, expectedOtp, otpExpiry }) => {
    try {
        if (!enteredOtp || String(enteredOtp).trim().length !== 6) {
            return { success: false, message: 'Enter a valid 6-digit OTP' };
        }

        if (!expectedOtp || !otpExpiry) {
            return { success: false, message: 'No email change request found' };
        }

        if (Date.now() > Number(otpExpiry)) {
            return { success: false, message: 'OTP expired. Please request a new one.' };
        }

        if (String(enteredOtp).trim() !== String(expectedOtp).trim()) {
            return { success: false, message: 'Invalid OTP' };
        }

        const normalizedEmail = String(pendingEmail || '').trim().toLowerCase();
        if (!normalizedEmail) {
            return { success: false, message: 'No pending email found' };
        }

        const existing = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: userId }
        });
        if (existing) {
            return { success: false, message: 'Email already in use' };
        }

        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        user.email = normalizedEmail;
        user.isVerified = true;
        await user.save();

        return { success: true, email: normalizedEmail };
    } catch (error) {
        console.log('Verify email change OTP error:', error);
        return { success: false, message: 'Unable to verify OTP right now' };
    }
};

export const resendOtpService = async (email) => {
    try {
        email = String(email || '').trim().toLowerCase();
        if (!email) return { success: false, message: 'Email required' };
        const user = await User.findOne({ email });
        if (!user) return { success: false, message: 'User not found' };

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = Date.now() + 5 * 60 * 1000;
        await user.save();

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Starzo OTP Verification",
                html: `
                    <h3>Your OTP Code</h3>
                    <p>Your verification OTP is:</p>
                    <h2>${otp}</h2>
                    <p>This OTP will expire in 5 minutes.</p>
                `
            });
        } catch (mailErr) {
            console.error('Error sending mail:', mailErr);
            return { success: false, message: 'Unable to deliver OTP email' };
        }
        return { success: true, email };
    } catch (error) {
        console.log('Resend OTP Error:', error);
        return { success: false, message: 'Failed to resend OTP' };
    }
};

// Helper to ensure all users have referral codes (run once or as needed)
export const syncReferralCodes = async () => {
    try {
        const usersWithoutCode = await User.find({ referralCode: { $exists: false } });
        for (const user of usersWithoutCode) {
            user.referralCode = await generateReferralCode();
            await user.save();
        }
        return { success: true, count: usersWithoutCode.length };
    } catch (error) {
        console.error('Sync referral codes error:', error);
        return { success: false };
    }
};
