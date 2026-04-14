import express from "express";
import { ensureLoggedIn } from "../../middlewares/authMiddleware.js";
import { getWishlist } from "../../services/user/wishlistService.js";
import * as wishlistController from "../../controllers/user/wishlistController.js"
const router= express.Router();

router.get("/", wishlistController.renderWishlistPage);
router.get("/data", wishlistController.getWishlist);

router.post("/toggle", wishlistController.toggleWishlist);
router.post("/add", wishlistController.addToWishlist);
router.post("/remove", wishlistController.removeFromWishlist);
router.post("/move-to-cart", wishlistController.moveToCart);
router.post("/move-all-to-cart", wishlistController.moveAllToCart);

export default router;