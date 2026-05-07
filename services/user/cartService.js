import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/Product.js";
import Category from "../../models/category/category.js";
import Wishlist from "../../models/wishlist/wishlist.js";
import { isSameVariant, findMatchingVariant, getVariantDisplayString } from "../../utils/productHelpers.js";
import * as offerService from "../common/offerService.js";
import { applyCouponService } from "./couponService.js";

/**
 * Service to handle cart operations
 */
/**
 * Helper to recalculate cart totals and validate applied coupon
 */
const _recalculateTotals = async (userId, cart) => {
    if (!cart || cart.items.length === 0) {
        return { subtotal: 0, originalSubtotal: 0, discount: 0, finalAmount: 0 };
    }

    // ── Recalculate Subtotals ──
    const originalSubtotal = cart.items.reduce((total, item) => {
        const originalPrice = item.product?.variants?.length > 0 && item.variant 
            ? (findMatchingVariant(item.product.variants, item.variant)?.price || item.product.price)
            : (item.product?.price || 0);
        return total + (originalPrice * item.qty);
    }, 0);
    const subtotal = cart.items.reduce((total, item) => total + (item.price * item.qty), 0);

    let discount = 0;
    let finalAmount = subtotal;

    // ── Recalculate Coupon ──
    if (cart.coupon) {
        try {
            const couponResult = await applyCouponService(userId, cart.coupon.code || cart.coupon);
            discount = couponResult.discount;
            finalAmount = couponResult.finalAmount;
        } catch (couponErr) {
            // Remove invalid coupon
            const CartModel = await import("../../models/cart/Cart.js").then(m => m.default);
            await CartModel.updateOne({ userId }, { $set: { coupon: null, discount: 0, finalAmount: subtotal } });
            cart.coupon = null;
        }
    }

    return { subtotal, originalSubtotal, discount, finalAmount };
};

export const updateCartTotals = async (userId) => {
    const cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart) return null;

    const totals = await _recalculateTotals(userId, cart);
    Object.assign(cart, totals);
    await cart.save();
    return cart;
};

export const getCartData = async (userId) => {
    let cart = await Cart.findOne({ userId })
        .populate({
            path: "items.product",
            populate: { path: "category" }
        })
        .populate("coupon")
        .lean();

    if (cart && cart.items.length > 0) {
        // Flag items as unavailable and update with BEST OFFER prices
        const updatedItems = [];
        for (const item of cart.items) {
            const product = item.product;
            if (!product) {
                updatedItems.push({ 
                    ...item, 
                    isUnavailable: true,
                    displayImage: '/images/placeholder.jpg',
                    variantDisplay: getVariantDisplayString(item.variant)
                });
                continue;
            }

            const isCategoryUnlisted = product.category?.isUnlisted || false;
            const isProductUnavailable = product.isBlocked || !product.isListed || isCategoryUnlisted;
            let isVariantUnavailable = false;
            let currentStock = product.stock || 0;

            if (product.variants?.length > 0 && item.variant) {
                const specificVariant = product.variants.find(v => isSameVariant(v, item.variant));
                if (!specificVariant || specificVariant.isDeleted) {
                    isVariantUnavailable = true;
                } else {
                    currentStock = specificVariant.stock || 0;
                }
            }

            let displayImage = '/images/placeholder.jpg';
            const currentVariant = item.variant;

            if (product.variants?.length > 0) {
                const defaultVariant = product.variants.find(v => !v.isDeleted) || product.variants[0];
                if (defaultVariant?.images?.length > 0) {
                    displayImage = defaultVariant.images[0];
                }
            }

            if (currentVariant && product.variants?.length > 0) {
                const matchedVariant = findMatchingVariant(product.variants, currentVariant);
                if (matchedVariant?.images?.length > 0) {
                    displayImage = matchedVariant.images[0];
                }
            }

            let basePrice = product.price || 0;
            if (product.variants?.length > 0 && item.variant) {
                const matched = findMatchingVariant(product.variants, item.variant);
                if (matched) {
                    basePrice = matched.price || 0;
                }
            }

            const { discountedPrice } = await offerService.getBestOfferForProduct({
                ...product,
                price: basePrice
            });

            updatedItems.push({ 
                ...item, 
                variantDisplay: getVariantDisplayString(currentVariant),
                displayImage,
                isUnavailable: isProductUnavailable || isVariantUnavailable,
                isOutOfStock: currentStock <= 0,
                insufficientStock: item.qty > currentStock,
                availableStock: currentStock,
                price: discountedPrice,
                originalPrice: basePrice
            });
        }
        cart.items = updatedItems;
        
        // Recalculate totals using helper
        const totals = await _recalculateTotals(userId, cart);
        Object.assign(cart, totals);
    } else if (!cart) {
        cart = { items: [], subtotal: 0, originalSubtotal: 0, finalAmount: 0, discount: 0 };
    }

    return cart;
};

export const addItemToCart = async (userId, { productId, variant, qty = 1 }) => {
    const product = await Product.findById(productId).populate('category');

    if (!product || product.isBlocked || !product.isListed || (product.category && product.category.isUnlisted)) {
        throw new Error("Product is unavailable");
    }

    // Standardize input variant to object format
    let targetVariant = typeof variant === 'string' ? null : variant;
    
    let price = product.price;
    let stock = product.stock || 0;

    // Active (non-deleted) variants only
    const activeVariants = (product.variants || []).filter(v => !v.isDeleted);

    // Find matching variant from product data to get correct price and stock
    const matchedVariant = findMatchingVariant(product.variants, targetVariant);
    
    if (matchedVariant) {
        // Explicitly reject soft-deleted variants
        if (matchedVariant.isDeleted) {
            throw new Error("The selected variant is no longer available");
        }
        targetVariant = {
            color: matchedVariant.color || "",
            storage: matchedVariant.storage || "",
            ram: matchedVariant.ram || ""
        };
        price = matchedVariant.price;
        stock = matchedVariant.stock;
    } else if (activeVariants.length > 0) {
        // If no variant provided or matched, but product has active variants, use the first active one
        const fallback = activeVariants[0];
        targetVariant = {
            color: fallback.color || "",
            storage: fallback.storage || "",
            ram: fallback.ram || ""
        };
        price = fallback.price;
        stock = fallback.stock;
    } else if (product.variants?.length > 0) {
        // All variants are soft-deleted
        throw new Error("No available variants for this product");
    } else {
        // For products without variants, use empty variant object
        targetVariant = { color: "", storage: "", ram: "" };
    }

    // Apply Best Offer
    const { discountedPrice } = await offerService.getBestOfferForProduct({
        ...product.toObject(),
        price: price
    });
    const finalPrice = discountedPrice;

    if (stock < 1) throw new Error("Item is out of stock");
    if (stock < qty) throw new Error(`Only ${stock} units available`);

    const MAX_PER_USER_LIMIT = 5;
    let cart = await Cart.findOne({ userId });

    if (!cart) {
        if (qty > MAX_PER_USER_LIMIT) {
            throw new Error(`Limit reached: Maximum ${MAX_PER_USER_LIMIT} units allowed`);
        }
        cart = new Cart({
            userId,
            items: [{ product: productId, variant: targetVariant, qty, price: finalPrice, originalPrice: price }]
        });
    } else {
        // Check if item with SAME product AND SAME variant already exists
        const itemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId && 
            isSameVariant(item.variant, targetVariant)
        );

        if (itemIndex > -1) {
            // Increase quantity if match found
            let newQty = cart.items[itemIndex].qty + Number(qty);

            if (newQty > MAX_PER_USER_LIMIT) {
                throw new Error(`Limit reached: Maximum ${MAX_PER_USER_LIMIT} units allowed`);
            }

            if (newQty > stock) {
                throw new Error("Cannot add more than available stock");
            }

            cart.items[itemIndex].qty = newQty;
            cart.items[itemIndex].price = finalPrice; // Update price with offer
            cart.items[itemIndex].originalPrice = price;
        } else {
            // Add new item if no match found
            if (qty > MAX_PER_USER_LIMIT) {
                throw new Error(`Limit reached: Maximum ${MAX_PER_USER_LIMIT} units allowed`);
            }
            cart.items.push({ product: productId, variant: targetVariant, qty, price: finalPrice, originalPrice: price });
        }
    }

    await cart.save();

    // 🕊️ Remove from Wishlist automatically if it exists there
    try {
        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            const initialCount = wishlist.items.length;
            wishlist.items = wishlist.items.filter(item => 
                !(item.productId.toString() === productId.toString() && isSameVariant(item.variant, targetVariant))
            );
            if (wishlist.items.length !== initialCount) {
                await wishlist.save();
            }
        }
    } catch (wishlistErr) {
        // We don't want to fail the cart addition if wishlist removal fails
        console.error("Failed to remove from wishlist during cart add:", wishlistErr);
    }

    const wishlist = await Wishlist.findOne({ userId });
    return {
        cartCount: cart.items.reduce((sum, item) => sum + item.qty, 0),
        wishlistCount: wishlist ? wishlist.items.length : 0
    };
};

export const updateItemQty = async (userId, { itemId, change }) => {
    const changeNum = Number(change);
    if (![1, -1].includes(changeNum)) {
        throw new Error("Invalid quantity change");
    }

    const cart = await Cart.findOne({ userId }).populate("items.product");
    if (!cart) {
        throw new Error("Cart not found");
    }

    const item = cart.items.id(itemId);
    if (!item) {
        throw new Error("Item not found in cart");
    }

    const newQty = item.qty + changeNum;
    if (newQty < 1) {
        throw new Error("Quantity cannot go below 1");
    }

    const MAX_PER_USER_LIMIT = 5;
    if (changeNum > 0 && newQty > MAX_PER_USER_LIMIT) {
        throw new Error(`Cannot exceed maximum limit of ${MAX_PER_USER_LIMIT}`);
    }

    // Stock & Price check for specific variant
    let stock = 0;
    let basePrice = 0;
    if (item.product) {
        stock = item.product.stock || 0;
        basePrice = item.product.price || 0;
        const productVariants = item.product.variants;

        if (productVariants?.length > 0) {
            const matched = findMatchingVariant(productVariants, item.variant);
            if (!matched && item.variant) {
                // The variant this item was referencing has been soft-deleted
                throw new Error("This item's variant is no longer available. Please remove it from your cart.");
            }
            if (matched) {
                stock = matched.stock;
                basePrice = matched.price || 0;
            }
        }
    }

    if (changeNum > 0 && newQty > stock) {
        throw new Error("Cannot exceed available stock");
    }

    // Recalculate best offer with current base price
    let discountedPrice = basePrice;
    if (item.product) {
        const offerResult = await offerService.getBestOfferForProduct({
            ...item.product.toObject(),
            price: basePrice
        });
        discountedPrice = offerResult.discountedPrice;
    }

    item.qty = newQty;
    item.price = discountedPrice || basePrice;
    item.originalPrice = basePrice;
    await cart.save();

    // Recalculate totals including coupon
    const totals = await _recalculateTotals(userId, cart);

    // Verify issues after update
    const hasIssues = cart.items.some(i => {
        const p = i.product;
        if (!p || p.isBlocked || !p.isListed) return true;
        
        let s = p.stock || 0;
        if (p.variants?.length > 0 && i.variant) {
            const v = p.variants.find(varnt => isSameVariant(varnt, i.variant));
            if (!v || v.isDeleted) return true;
            s = v.stock || 0;
        }
        return i.qty > s || s <= 0;
    });

    return {
        newQty: item.qty,
        itemTotal: item.price * item.qty,
        cartSubtotal: totals.subtotal,
        cartDiscount: totals.discount,
        cartFinalAmount: totals.finalAmount,
        cartCount: cart.items.reduce((sum, i) => sum + i.qty, 0),
        itemStatus: {
            isUnavailable: !item.product || item.product.isBlocked || !item.product.isListed,
            isOutOfStock: stock <= 0,
            insufficientStock: item.qty > stock,
            availableStock: stock
        },
        hasIssues
    };
};

export const removeItem = async (userId, itemId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
        throw new Error("Cart not found");
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    await cart.save();

    // Population is needed to check issues for the remaining items
    await cart.populate("items.product");

    const hasIssues = cart.items.some(i => {
        const p = i.product;
        if (!p || p.isBlocked || !p.isListed) return true;
        
        let s = p.stock || 0;
        if (p.variants?.length > 0 && i.variant) {
            const v = p.variants.find(varnt => isSameVariant(varnt, i.variant));
            if (!v || v.isDeleted) return true;
            s = v.stock || 0;
        }
        return i.qty > s || s <= 0;
    });

    // Recalculate totals including coupon
    const totals = await _recalculateTotals(userId, cart);

    return {
        cartSubtotal: totals.subtotal,
        cartDiscount: totals.discount,
        cartFinalAmount: totals.finalAmount,
        cartCount: cart.items.reduce((sum, i) => sum + i.qty, 0),
        isEmpty: cart.items.length === 0,
        hasIssues
    };
};

export const clearCart = async (userId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
        throw new Error("Cart not found");
    }
    cart.items = [];
    await cart.save();
    return true;
};
