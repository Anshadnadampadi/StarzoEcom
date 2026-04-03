import * as cartService from "../../services/user/cartService.js";

// Fetch user's cart
export const getCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/auth/login?msg=Please login to view cart&icon=info");
        }

        const cart = await cartService.getCartData(req.session.user);
        const { msg, icon } = req.query;
        res.render("user/cart", { 
            cart, 
            title: "Shopping Cart — MobiVerse",
            breadcrumbs: [
                { label: 'Shop', url: '/products' },
                { label: 'Cart', url: '/cart' }
            ],
            msg: msg || null, 
            icon: icon || null 
        });

    } catch (error) {
        console.error("Get Cart Error:", error);
        res.status(500).send("Server Error");
    }
};

// Add product to cart
export const addToCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Please login to add to cart" });
        }

        const cartCount = await cartService.addItemToCart(req.session.user, req.body);

        return res.status(200).json({ 
            success: true, 
            message: "Added to cart successfully",
            cartCount
        });

    } catch (error) {
        console.error("Add to Cart Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Something went wrong" });
    }
};

// Update cart quantity
export const updateCartQty = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const stats = await cartService.updateItemQty(req.session.user, req.body);

        return res.json({ 
            success: true, 
            message: "Quantity updated",
            ...stats
        });

    } catch (error) {
        console.error("Update Cart Qty Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Something went wrong" });
    }
};

// Remove item from cart
export const removeCartItem = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const status = await cartService.removeItem(req.session.user, req.body.itemId);

        return res.json({ 
            success: true, 
            message: "Item removed from cart",
            ...status
        });

    } catch (error) {
        console.error("Remove Cart Item Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Something went wrong" });
    }
};
