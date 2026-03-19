import User from "../../models/user/User.js";
import Address from "../../models/user/Address.js";
import bcrypt from "bcryptjs";
import { registerUser, loginUser, updateUserProfile, changeUserPassword, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress, validateAndNormalizeAddress } from "../../services/user/authServices.js";
import { sendOtpService, verifyOtpService, forgotPasswordService, resendOtpService, requestEmailChangeOtpService, verifyEmailChangeOtpService } from "../../services/user/authServices.js";


export const getHome = async (req, res) => {
    try {
        const user = req.session.user ? await User.findById(req.session.user).lean() : null;


        res.render("user/home", { user });

    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};


export const getSignup = (req, res) => {
    res.render("user/signUp");
};


export const postSignup = async (req, res) => {
    try {

        const result = await sendOtpService(req.body);

        // If service failed
        if (!result.success) {
            return res.redirect(`/auth/signup?msg=${encodeURIComponent(result.message)}`);
        }

        // OTP sent successfully
        return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(result.email)}`);

    } catch (error) {

        console.error("Signup Controller Error:", error);

        return res.redirect("/auth/signup?msg=Something went wrong");

    }
};
export const getForgotPassword = (req, res) => {
    res.render("user/forgotPassword");

};

// handle submission of the forgot-password form
export const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await forgotPasswordService(email);
        if (!result.success) {
            return res.send(result.message);
        }

        // send the user to the OTP verification page and mark the flow as
        // a password reset by including a query parameter
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}&context=reset`);
    } catch (err) {
        console.error("Forgot password controller error", err);
        res.status(500).send("Server error");
    }
};

 export const getlogin = (req, res) => {

    const { msg, icon, error } = req.query;

    let message = null;

    if (error === "blocked") {
        message = "Your account has been blocked by admin.";
    }

    res.render("user/login", {
        msg,
        icon,
        message
    });

}; 

export const postLogin = async (req, res) => {
    try {

        const { email, password } = req.body;

        // check empty fields
        if (!email || !password) {
            return res.redirect("/auth/login?msg=All fields required");
        }

        // find user
        const user = await User.findOne({ email });

        if (!user) {
            return res.redirect("/auth/login?msg=Invalid email or password");
        }

        // compare password
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.redirect("/auth/login?msg=Invalid email or password");
        }

        // blocked user check
        if (user.isBlocked) {
            return res.redirect("/auth/login?msg=Your account is blocked");
        }

        // create session
        req.session.user = user._id;

        return res.redirect("/");

    } catch (error) {
        console.log(error);
        res.redirect("/auth/login?msg=Something went wrong");
    }
};


export const emailVerify = async (req, res) => {

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return res.send("User not found")
    }

    const result = await sendOtpService(req.body);

    if (!result.success) {
        return res.send(result.message);
    }

    res.redirect(`/auth/verify-otp?email=${result.email}`);
};

export const resendOtp = async (req, res) => {
    const { email, context } = req.query;
    if (!email) {
        return res.redirect('/');
    }
    // choose service based on context; reset flow uses forgotPasswordService while signup uses resendOtpService
    let result;
    if (context === 'reset') {
        result = await forgotPasswordService(email);
    } else {
        result = await resendOtpService(email);
    }
    if (!result.success) {
        return res.send(result.message);
    }
    res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}${context ? `&context=${context}` : ''}`);
};

export const getOtp = (req, res) => {
    res.render("user/otpVerification")
}
export const resetPassword = (req, res) => {
    res.render("user/resetPassword", {
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
        if (!email) return res.send("Email is required");
        if (!password || !confirmPassword) return res.send("Password fields required");
        if (password !== confirmPassword) return res.send("Passwords do not match");

        const user = await User.findOne({ email });
        if (!user) return res.send("User not found");

        const hashed = await bcrypt.hash(password, 10);
        user.password = hashed;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        // redirect to login with flag so we can show a modal
        res.redirect("/auth/login?msg=Password updated successfully&icon=success");
    } catch (err) {
        return res.redirect("/auth/login?msg=Password update failed&icon=error");
    }
};



/* POST Signup → Send OTP */
export const otpSignup = async (req, res) => {
    const result = await sendOtpService(req.body);

    if (!result.success) {
        return res.send(result.message);
    }

    res.redirect(`/auth/verify-otp?email=${result.email}`);
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
    res.render("user/otpVerification", {
        email: req.query.email,
        error:null,
        context: req.query.context || "signup",
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
        res.render("user/userProfile", { user, currentPath: req.path });
    } catch (err) {
        console.error('Get profile error', err);
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
        const user = await User.findById(req.session.user).lean();
        if (!user) return res.status(404).send('User not found');
        res.render("user/address", { user, currentPath: req.path });
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

        const result = await validateAndNormalizeAddress(req.body);
        if (!result.success) {
            const status = result.code === 'ADDRESS_VALIDATION_UNAVAILABLE' ? 503 : 400;
            return res.status(status).json(result);
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Validate address error', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// create new address
export const postAddress = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
        
        const validation= await validateAndNormalizeAddress(req.body)
        if (!validation.success) {
            const status = validation.code === 'ADDRESS_VALIDATION_UNAVAILABLE' ? 503 : 400;
           return res.status(status).json(validation);
        }
        const result = await addUserAddress(req.session.user,validation.address );
           
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
        res.render("user/editProfile", { user, currentPath: req.path, msg, icon });
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
            const imageUrl = `/uploads/profile/${req.file.filename}`;
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
        const imagePath = `/uploads/profile/${req.file.filename}`

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
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Server error' });
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};
export const updateProfile = async (req, res) => {
  
  try{
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

    if(Object.keys(updateData).length === 0){
   return res.redirect("/profile?msg=No changes made&icon=info");
}


    await User.findByIdAndUpdate(userId, updateData);

     return res.redirect("/profile?msg=Profile updated successfully&icon=success");
  } catch(error){
  console.log("profile Update error",error)
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

