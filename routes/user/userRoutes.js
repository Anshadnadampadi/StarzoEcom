import User from "../../models/user/User.js";
import Address from "../../models/user/Address.js";
import express from "express";
import {
    getHome,
    getAddress,
    postAddress,
    putAddress, deleteAddress,
    patchDefaultAddress,
    getProfile,
    geteditProfile,
    postEditProfile,
    postUpdateProfile,
    postChangePassword,
    updateProfileImage,
    removeProfileImage,
    requestEmailChangeOtp,
    verifyAndActivateEmailChange
} from "../../controllers/user/userController.js";
import { ensureLoggedIn } from "../../middlewares/authMiddleware.js";
import { uploadProfileImage } from "../../middlewares/uploadMiddleware.js";
import authRoutes from "../../routes/user/authRoutes.js";

const router = express.Router();

// Mount auth sub-router
router.use("/auth", authRoutes);

// Home
router.get("/", getHome);

// Address
router.get('/address', ensureLoggedIn, getAddress);
router.post('/address', ensureLoggedIn, postAddress);
router.put('/address/:id', ensureLoggedIn, putAddress);
router.delete('/address/:id', ensureLoggedIn, deleteAddress);
router.patch('/address/default/:id', ensureLoggedIn, patchDefaultAddress);

// Product List (inline shortcut – full listing handled by /user/products)
router.get('/productList', (req, res) => {
    res.render('user/product/productListPage');
});

// Profile
router.get("/profile", ensureLoggedIn, async (req, res) => {
    try {
        const msg = req.query.msg || null;
        const icon = req.query.icon || null;
        const user = await User.findById(req.session.user);
        res.render("user/userProfile", { user, msg, icon });
    } catch (error) {
        console.log("Profile page error:", error);
        res.redirect("/");
    }
});

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
