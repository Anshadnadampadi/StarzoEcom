import express from "express";
import { ensureLoggedIn } from "../../middlewares/authMiddleware.js";
import { getCart, addToCart, updateCartQty, removeCartItem, clearCart } from "../../controllers/user/cartController.js";

const router = express.Router();

router.get("/", getCart);
router.post("/add", addToCart);
router.post("/update-qty", updateCartQty);
router.post("/remove", removeCartItem);
router.post("/clearcart",ensureLoggedIn,clearCart)

export default router;
