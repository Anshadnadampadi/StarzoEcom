import User from "../../models/user/User.js";

import express from "express";
import {
    getProfile,
    getHome,
    geteditProfile,
    postEditProfile,
    postUpdateProfile,
    postChangePassword,
    updateProfileImage,
    removeProfileImage,
    requestEmailChangeOtp,
    verifyAndActivateEmailChange,
  

} from "../../controllers/user/userController.js";
import { ensureLoggedIn, checkBlocked } from "../../middlewares/authMiddleware.js";
import { uploadProfileImage } from "../../middlewares/uploadMiddleware.js";
import authRoutes from "../../routes/user/authRoutes.js";
import passport from "passport"
import addressRoutes from "./addressRoutes.js"
import cartRoutes from "./cartRoutes.js"

const router = express.Router();

// Mount auth sub-router
router.use("/auth", authRoutes);

// Protected User Routes (Require checkBlocked + ensureLoggedIn for private data)
router.use("/account", ensureLoggedIn, addressRoutes);
router.use("/cart", ensureLoggedIn, cartRoutes);

// Google OAuth (Root level to match Console config)
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth/login?error=blocked" }),
    (req, res) => {
        req.session.user = req.user._id;
        res.redirect("/");
    }
);

// Home & Public
router.get("/", getHome);

// Profile Management (Require Auth)
router.get("/profile", ensureLoggedIn, getProfile);
router.post("/profile", ensureLoggedIn, postUpdateProfile);
router.post("/profile/password", ensureLoggedIn, postChangePassword);
router.get("/editProfile", ensureLoggedIn, geteditProfile);
router.post("/editProfile", ensureLoggedIn, uploadProfileImage.single("profileImage"), postEditProfile);
router.post("/change-email/request", ensureLoggedIn, requestEmailChangeOtp);
router.post("/change-email/verify", ensureLoggedIn, verifyAndActivateEmailChange);

// Profile Image
router.post("/upload-profile", ensureLoggedIn, uploadProfileImage.single("profileImage"), updateProfileImage);
router.delete("/upload-profile", ensureLoggedIn, removeProfileImage);


export default router;
