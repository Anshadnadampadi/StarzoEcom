import express from "express";
import { ensureLoggedIn } from "../../middlewares/authMiddleware.js";
import { getCart, addToCart, updateCartQty, removeCartItem, clearCart, getAvailableCoupons } from "../../controllers/user/cartController.js";

const router = express.Router();

router.get("/",ensureLoggedIn, getCart);
router.post("/add", addToCart);
router.post("/update-qty", updateCartQty);
router.post("/remove", removeCartItem);
router.post("/clearcart",ensureLoggedIn,clearCart)
router.get("/available-coupons", ensureLoggedIn, getAvailableCoupons);

export default router;
