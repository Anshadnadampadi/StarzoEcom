import Wishlist from "../../models/wishlist/wishlist.js";
import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/Product.js";
import * as cartService from "./cartService.js";
import { isSameVariant, findMatchingVariant, getVariantDisplayString } from "../../utils/productHelpers.js";

/**
 * Fetch user's wishlist with populated product and variant details
 */
export const getWishlist = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId })
        .populate({
            path: "items.productId",
            populate: { path: "brand" }
        });

    if (!wishlist || !wishlist.items?.length) return [];

    return wishlist.items.map(item => {
        const product = item.productId;
        if (!product) return null;

        const currentVariant = item.variant;
        
        // Find the best matching variant from product data for accurate price/stock/image
        const matchedVariant = findMatchingVariant(product.variants, currentVariant) || product.variants?.[0];

        return {
            ...product.toObject(),
            variant: currentVariant, // Store the selected variant object
            variantDisplay: getVariantDisplayString(currentVariant),
            price: matchedVariant?.price || product.price,
            stock: matchedVariant?.stock || product.stock,
            image: matchedVariant?.images?.[0] || product.image || "/images/placeholder.jpg"
        };
    }).filter(Boolean);
};

/**
 * Helper to check if a product + variant already exists in wishlist
 */
const isItemInWishlist = (wishlistItems, productId, variant) => {
    return wishlistItems.some(item => 
        item.productId?.toString() === productId.toString() && 
        isSameVariant(item.variant, variant)
    );
};

export const toggleWishlist = async (userId, productId, variant = {}) => {
    let wishlist = await Wishlist.findOne({ userId });

    // Ensure variant is in object format
    const targetVariant = {
        color: variant?.color || "",
        storage: variant?.storage || "",
        ram: variant?.ram || ""
    };

    if (!wishlist) {
        wishlist = new Wishlist({
            userId,
            items: [{ productId, variant: targetVariant }]
        });
        await wishlist.save();
        return { count: 1, added: true };
    }

    const index = wishlist.items.findIndex(item => 
        item.productId?.toString() === productId.toString() && 
        isSameVariant(item.variant, targetVariant)
    );

    let added = false;
    if (index > -1) {
        wishlist.items.splice(index, 1);
    } else {
        wishlist.items.push({ productId, variant: targetVariant });
        added = true;
    }

    await wishlist.save();
    return { count: wishlist.items.length, added };
};

export const addToWishlist = async (userId, productId, variant = {}) => {
    let wishlist = await Wishlist.findOne({ userId });

    const targetVariant = {
        color: variant?.color || "",
        storage: variant?.storage || "",
        ram: variant?.ram || ""
    };

    if (!wishlist) {
        wishlist = new Wishlist({
            userId,
            items: [{ productId, variant: targetVariant }]
        });
    } else {
        if (isItemInWishlist(wishlist.items, productId, targetVariant)) {
            throw new Error("Item is already in your wishlist");
        }
        wishlist.items.push({ productId, variant: targetVariant });
    }

    return await wishlist.save();
};

export const removeFromWishlist = async (userId, productId, variant = {}) => {
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) throw new Error("Wishlist not found");

    wishlist.items = wishlist.items.filter(item => 
        !(item.productId?.toString() === productId.toString() && isSameVariant(item.variant, variant))
    );

    return await wishlist.save();
};

/**
 * Move a single item from wishlist to cart
 */
export const moveToCart = async (userId, productId, variant) => {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Product not found or unavailable");

    // Validate that the variant actually exists for this product
    const matchedVariant = findMatchingVariant(product.variants, variant);
    if (product.variants?.length > 0 && !matchedVariant) {
        throw new Error("The selected variant is no longer available");
    }

    // Add to cart
    await cartService.addItemToCart(userId, { 
        productId, 
        variant: variant, // Pass the object, addItemToCart will handle it
        qty: 1 
    });

    // Remove from wishlist after successful cart addition
    await removeFromWishlist(userId, productId, variant);
    
    return { success: true };
};

/**
 * Move all valid items from wishlist to cart
 */
export const moveAllToCart = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist || wishlist.items.length === 0) {
        throw new Error("Wishlist is empty");
    }

    let successCount = 0;
    let errors = [];

    // Use a copy to iterate while we might be modifying the original (though we clear it at the end)
    const itemsToMove = [...wishlist.items];

    for (const item of itemsToMove) {
        try {
            await cartService.addItemToCart(userId, {
                productId: item.productId.toString(),
                variant: item.variant,
                qty: 1
            });
            successCount++;
        } catch (err) {
            errors.push(`${item.productId}: ${err.message}`);
        }
    }

    // Clear wishlist items that were successfully moved (or just clear all as per Flipkart style)
    wishlist.items = [];
    await wishlist.save();

    return { 
        success: true, 
        message: `Moved ${successCount} items to your cart`,
        failedCount: errors.length
    };
};