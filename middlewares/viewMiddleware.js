import Cart from "../models/cart/Cart.js";
import * as wishlistService from "../services/user/wishlistService.js";

export const setViewLocals = async (req, res, next) => {
    // 1. Handle Toast Messages
    if (req.session.toast) {
        res.locals.toast = req.session.toast;
        delete req.session.toast;
    } else {
        res.locals.toast = null;
    }

    // 2. Set User and Basic Locals
    res.locals.user = req.session.user || null;
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    res.locals.breadcrumbs = [];
    
    // Support legacy query params for messages
    if (req.query.msg) {
        res.locals.toast = {
            message: req.query.msg,
            type: req.query.icon || 'info'
        };
    }

    // 3. Fetch Cart Count if User Logged In
    if (req.session.user) {
        try {
            const [cart, wishlist] = await Promise.all([
                Cart.findOne({ userId: req.session.user }).lean(),
                wishlistService.getWishlist(req.session.user)
            ]);

            if (cart?.items?.length) {
                res.locals.cartCount = cart.items.length;
            }

            if (wishlist?.length) {
                res.locals.wishlistCount = wishlist.length;
            }
        } catch (error) {
            console.error("Error fetching cart/wishlist counts:", error);
        }
    }

    next();
};

export const setAdminLayout = (req, res, next) => {
    res.locals.layout = "layouts/admin";
    next();
};
