// controllers/wishlistController.js
import Cart from "../../models/cart/Cart.js"
import * as wishlistService from "../../services/user/wishlistService.js";
import User from "../../models/user/User.js";


// TOGGLE WISHLIST
export const toggleWishlist = async (req, res) => {
    try {
        const { productId, color, storage, ram } = req.body;

        const { count, added } = await wishlistService.toggleWishlist(
            req.session.user,
            productId,
            { color, storage, ram }
        );

        return res.json({
            success: true,
            added,
            wishlistCount: count,
            message: added ? "Added to wishlist " : "Removed from wishlist "
        });

    } catch (err) {
        console.error("Toggle Wishlist Error:", err.message);
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

//  ADD TO WISHLIST
export const addToWishlist = async (req, res) => {

    try {
        const { productId, color, storage, ram } = req.body;

        if (!productId) {
            return res.status(400).json({ error: "Product ID required" });
        }

        await wishlistService.addToWishlist(
            req.session.user,
            productId,
            { color, storage, ram }
        );

        const updatedWishlist = await wishlistService.getWishlist(req.session.user);

        return res.json({
            success: true,
            message: "Added to wishlist",
            wishlistCount: updatedWishlist.length
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
            req.session.user,
            productId,
            { color, storage, ram }
        );

        const updatedWishlist = await wishlistService.getWishlist(req.session.user);

        return res.json({
            success: true,
            message: "Removed from wishlist",
            wishlistCount: updatedWishlist.length
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
        const wishlist = await wishlistService.getWishlist(req.session.user);

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
//    RENDER WISHLIST PAGE (EJS)
export const renderWishlistPage = async (req, res) => {
    try {
        const wishlist = await wishlistService.getWishlist(req.session.user);

        res.render("user/account/wishlist", {
            wishlist,
            user: await User.findById(req.session.user).lean(),
            breadcrumbs: [
                { label: 'Profile', url: '/profile' },
                { label: 'Wishlist', url: '/wishlist' }
            ]
        });

    } catch (err) {
        console.error("Render Wishlist Error:", err.message);

        res.status(500).send("Error loading wishlist page");
    }
};

//  MOVE TO CART
export const moveToCart = async (req, res) => {
    console.log(req.body)
    try {
        const { productId, color, storage, ram } = req.body;

        await wishlistService.moveToCart(
            req.session.user,
            productId,
            { color, storage, ram }
        );

        // Fetch updated counts for both tools to keep UI in sync
        const [updatedWishlist, cart] = await Promise.all([
            wishlistService.getWishlist(req.session.user),
            Cart.findOne({ userId: req.session.user }).select("items").lean()
        ]);

        return res.json({
            success: true,
            message: "Moved to cart 🛒",
            wishlistCount: updatedWishlist.length,
            cartCount: cart?.items?.length || 0
        });

    } catch (err) {
        console.error("Move To Cart Error:", err.message);

        return res.status(400).json({
            success: false,
            error: err.message
        });
    }
};

// MOVE ALL TO CART
export const moveAllToCart = async (req, res) => {
    try {
        const result = await wishlistService.moveAllToCart(req.session.user);
        
        if (result.success) {
            return res.json(result);
        } else {
            return res.status(400).json({ success: false, error: result.message });
        }

    } catch (err) {
        console.error("Move All To Cart Error:", err.message);
        return res.status(500).json({
            success: false,
            error: "Failed to move all items to cart"
        });
    }
};

