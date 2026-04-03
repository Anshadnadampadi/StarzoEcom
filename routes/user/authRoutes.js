import express from "express";
import {
    getSignup,
    postSignup,
    otpSignup,
    getlogin,
    postLogin,
    getForgotPassword,
    postForgotPassword,
    loadVerifyOtp,
    postVerifyOtp,
    resendOtp,
    emailVerify,
    resetPassword,
    postResetPassword,
    resetSuccess,
    logout,
} from "../../controllers/user/userController.js";
import { ensureLoggedIn, ensureLoggedOut } from "../../middlewares/authMiddleware.js";


const router = express.Router();

// Sign Up
router.route("/register")
    .get(ensureLoggedOut, getSignup)
    .post(ensureLoggedOut, postSignup);

// Login / Logout
router.get("/login", ensureLoggedOut, getlogin);
router.post("/login", ensureLoggedOut, postLogin);
router.get("/logout", ensureLoggedIn, logout);

// Forgot Password
router.get("/forgot", ensureLoggedOut, getForgotPassword);
router.post("/forgot", ensureLoggedOut, postForgotPassword);

// Email Verify (for forgot password flow)
router.post("/verify-email", ensureLoggedOut, emailVerify);

// OTP
router.get("/verify-otp", ensureLoggedOut, loadVerifyOtp);
router.post("/verify-otp", ensureLoggedOut, postVerifyOtp);
router.get("/resend-otp", ensureLoggedOut, resendOtp);

// Reset Password
router.get("/reset-password", ensureLoggedOut, resetPassword);
router.post("/reset-password", ensureLoggedOut, postResetPassword);
router.get("/reset-success", ensureLoggedOut, resetSuccess);


export default router;
