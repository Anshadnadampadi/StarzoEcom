import Wishlist from "../../models/wishlist/wishlist.js";
import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/Product.js";
import * as cartService from "./cartService.js";
import { isSameVariant, findMatchingVariant, getVariantDisplayString, normalize } from "../../utils/productHelpers.js";

/**
 * Fetch user's wishlist with populated product and variant details
 */
export const getWishlist = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId })
        .populate({
            path: "items.productId",
            populate: [{ path: "brand" }, { path: "category" }]
        });

    if (!wishlist || !wishlist.items?.length) return [];

    const processedItems = wishlist.items.map(item => {
        const product = item.productId;
        if (!product) return null;

        // Only skip if the product is explicitly blocked by admin or category is unlisted.
        // Unlisted products remain visible but flagged as unavailable.
        if (product.isBlocked || (product.category && product.category.isUnlisted)) return null;

        const currentVariant = item.variant;
        
        // Match the specific variant stored in wishlist
        const specificVariant = findMatchingVariant(product.variants, currentVariant);
        const isVariantDeleted = !!(specificVariant && specificVariant.isDeleted);

        // If product has variants, use the specific saved variant's data. 
        // We do NOT fallback to other variants as per user request.
        const displayVariant = specificVariant || product.variants?.[0];

        // Create a unique key for deduplication
        const uniqueKey = `${product._id}_${normalize(currentVariant?.color)}_${normalize(currentVariant?.storage)}_${normalize(currentVariant?.ram)}`;

        return {
            _dedupeKey: uniqueKey,
            ...product.toObject(),
            variant: currentVariant,
            variantDisplay: getVariantDisplayString(currentVariant),
            price: displayVariant?.price || product.price,
            stock: displayVariant?.stock || product.stock,
            image: displayVariant?.images?.[0] || product.image || "/images/placeholder.jpg",
            isVariantUnavailable: isVariantDeleted || !specificVariant // True if deleted OR not found in current product data
        };
    }).filter(Boolean);

    // Deduplicate by uniqueKey
    const uniqueItems = [];
    const seen = new Set();
    for (const item of processedItems) {
        if (!seen.has(item._dedupeKey)) {
            seen.add(item._dedupeKey);
            delete item._dedupeKey;
            uniqueItems.push(item);
        }
    }

    return uniqueItems;
};

/**
 * Fetch only the count of items in the wishlist for header/middleware
 */
export const getWishlistCount = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId }).select('items').lean();
    return wishlist?.items?.length || 0;
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
    const product = await Product.findById(productId);

    if (!product) throw new Error("Product not found");

    // Ensure variant is in object format
    let targetVariant = {
        color: variant?.color || "",
        storage: variant?.storage || "",
        ram: variant?.ram || ""
    };

    // If product has variants but the request is 'blank' (e.g. from catalog page), 
    // pick the default active variant to prevent duplicates and ensure data integrity.
    const isBlank = !targetVariant.color && !targetVariant.storage && !targetVariant.ram;
    if (isBlank && product.variants?.length > 0) {
        const defaultV = product.variants.find(v => !v.isDeleted) || product.variants[0];
        if (defaultV) {
            targetVariant = {
                color: defaultV.color || "",
                storage: defaultV.storage || "",
                ram: defaultV.ram || ""
            };
        }
    }

    if (!wishlist) {
        wishlist = new Wishlist({
            userId,
            items: [{ productId, variant: targetVariant }]
        });
        await wishlist.save();
        return { count: 1, added: true, message: "Added to wishlist" };
    }

    const index = wishlist.items.findIndex(item => 
        item.productId?.toString() === productId.toString() && 
        isSameVariant(item.variant, targetVariant)
    );

    let added = false;
    let message = "";

    if (index > -1) {
        wishlist.items.splice(index, 1);
        message = "Removed from wishlist";
    } else {
        wishlist.items.push({ productId, variant: targetVariant });
        added = true;
        message = "Added to wishlist";
    }

    await wishlist.save();
    
    // Get the deduplicated unique count for consistent UI reporting
    const updatedWishlist = await getWishlist(userId);
    
    return { count: updatedWishlist.length, added, message };
};

export const addToWishlist = async (userId, productId, variant = {}) => {
    let wishlist = await Wishlist.findOne({ userId });
    const product = await Product.findById(productId);

    if (!product) throw new Error("Product not found");

    let targetVariant = {
        color: variant?.color || "",
        storage: variant?.storage || "",
        ram: variant?.ram || ""
    };

    // Auto-fill variant if blank and variants exist
    const isBlank = !targetVariant.color && !targetVariant.storage && !targetVariant.ram;
    if (isBlank && product.variants?.length > 0) {
        const defaultV = product.variants.find(v => !v.isDeleted) || product.variants[0];
        if (defaultV) {
            targetVariant = {
                color: defaultV.color || "",
                storage: defaultV.storage || "",
                ram: defaultV.ram || ""
            };
        }
    }

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
    const product = await Product.findById(productId).populate('category');
    if (!product) throw new Error("Product not found or unavailable");
    if (product.isBlocked || !product.isListed || (product.category && product.category.isUnlisted)) throw new Error("Product is currently unavailable");

    // Validate that the variant actually exists and is not soft-deleted
    if (product.variants?.length > 0) {
        const matchedVariant = findMatchingVariant(product.variants, variant);
        if (!matchedVariant || matchedVariant.isDeleted) {
            throw new Error("The selected variant is no longer available");
        }
    }

    // Add to cart
    await cartService.addItemToCart(userId, { 
        productId, 
        variant: variant,
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

    // Use a copy to iterate because cartService.addItemToCart will modify the DB wishlist items
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
            // Log individual item failures but continue moving others
            errors.push(`${item.productId}: ${err.message}`);
        }
    }

    // Fetch final counts after all operations are complete
    const [finalWishlist, finalCart] = await Promise.all([
        Wishlist.findOne({ userId }).select("items").lean(),
        Cart.findOne({ userId }).select("items").lean()
    ]);

    return { 
        success: true, 
        message: successCount > 0 
            ? `Successfully moved ${successCount} items to cart` 
            : "No items could be moved to cart",
        successCount,
        failedCount: errors.length,
        wishlistCount: finalWishlist?.items?.length || 0,
        cartCount: finalCart?.items?.length || 0
    };
};