// controllers/wishlistController.js

import * as wishlistService from "../../services/user/wishlistService.js";


//  ADD TO WISHLIST
export const addToWishlist = async (req, res) => {
    try {
        const { productId, color, storage, ram } = req.body;

        if (!productId) {
            return res.status(400).json({ error: "Product ID required" });
        }

        await wishlistService.addToWishlist(
            req.user.id,
            productId,
            { color, storage, ram }
        );

        return res.json({
            success: true,
            message: "Added to wishlist ❤️"
        });

    } catch (err) {
        console.error("Add Wishlist Error:", err.message);

        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
};

//  REMOVE FROM WISHLIST

export const removeFromWishlist = async (req, res) => {
    try {
        const { productId, color, storage, ram } = req.body;

        await wishlistService.removeFromWishlist(
            req.user.id,
            productId,
            { color, storage, ram }
        );

        return res.json({
            success: true,
            message: "Removed from wishlist ❌"
        });

    } catch (err) {
        console.error("Remove Wishlist Error:", err.message);

        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
};

export const getWishlist = async (req, res) => {
    try {
        const wishlist = await wishlistService.getWishlist(req.user.id);

        return res.json({
            success: true,
            data: wishlist
        });

    } catch (err) {
        console.error("Get Wishlist Error:", err.message);

        return res.status(500).json({
            success: false,
            error: "Failed to fetch wishlist"
        });
    }
};
// 🎨 RENDER WISHLIST PAGE (EJS)
export const renderWishlistPage = async (req, res) => {
    try {
        const wishlist = await wishlistService.getWishlist(req.user.id);

        res.render("user/account/wishlist", {
            wishlist,
            user: req.user
        });

    } catch (err) {
        console.error("Render Wishlist Error:", err.message);

        res.status(500).send("Error loading wishlist page");
    }
};

// 🔁 MOVE TO CART
export const moveToCart = async (req, res) => {
    try {
        const { productId, color, storage, ram } = req.body;

        await wishlistService.moveToCart(
            req.user.id,
            productId,
            { color, storage, ram }
        );

        return res.json({
            success: true,
            message: "Moved to cart 🛒"
        });

    } catch (err) {
        console.error("Move To Cart Error:", err.message);

        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
};

