import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/Product.js";
import { isSameVariant, findMatchingVariant, getVariantDisplayString } from "../../utils/productHelpers.js";
import * as offerService from "../common/offerService.js";

/**
 * Service to handle cart operations
 */
export const getCartData = async (userId) => {
    let cart = await Cart.findOne({ userId }).populate("items.product").lean();

    if (cart && cart.items.length > 0) {
        // Flag items as unavailable and update with BEST OFFER prices
        const updatedItems = [];
        for (const item of cart.items) {
            const product = item.product;
            if (!product) return { ...item, isUnavailable: true };

            const isProductUnavailable = product.isBlocked || !product.isListed;
            let isVariantUnavailable = false;
            let currentStock = product.stock || 0;

            if (product.variants?.length > 0 && item.variant) {
                // Check if the specific variant stored in cart is soft-deleted
                const specificVariant = product.variants.find(v => isSameVariant(v, item.variant));
                if (!specificVariant || specificVariant.isDeleted) {
                    isVariantUnavailable = true;
                } else {
                    currentStock = specificVariant.stock || 0;
                }
            }

            let displayImage = '/images/placeholder.jpg';
            const currentVariant = item.variant;

            // Use first non-deleted variant image as default
            if (product.variants?.length > 0) {
                const defaultVariant = product.variants.find(v => !v.isDeleted) || product.variants[0];
                if (defaultVariant?.images?.length > 0) {
                    displayImage = defaultVariant.images[0];
                }
            }

            // If item has a specific variant, try to match it for the correct image
            if (currentVariant && product.variants?.length > 0) {
                const matchedVariant = findMatchingVariant(product.variants, currentVariant);
                if (matchedVariant?.images?.length > 0) {
                    displayImage = matchedVariant.images[0];
                }
            }

            // ── Offer Calculation ──
            const { discountedPrice } = await offerService.getBestOfferForProduct({
                ...product,
                price: item.price // Use the base price of the item/variant
            });

            updatedItems.push({ 
                ...item, 
                variantDisplay: getVariantDisplayString(currentVariant),
                displayImage,
                isUnavailable: isProductUnavailable || isVariantUnavailable,
                isOutOfStock: currentStock <= 0,
                insufficientStock: item.qty > currentStock,
                availableStock: currentStock,
                price: discountedPrice // Use discounted price
            });
        }
        cart.items = updatedItems;
        // Recalculate subtotal with discounted prices
        cart.subtotal = updatedItems.reduce((total, item) => total + (item.price * item.qty), 0);
    } else if (!cart) {
        cart = { items: [], subtotal: 0 };
    }

    return cart;
};

export const addItemToCart = async (userId, { productId, variant, qty = 1 }) => {
    const product = await Product.findById(productId);

    if (!product || product.isBlocked || !product.isListed) {
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
            items: [{ product: productId, variant: targetVariant, qty, price }]
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
        } else {
            // Add new item if no match found
            if (qty > MAX_PER_USER_LIMIT) {
                throw new Error(`Limit reached: Maximum ${MAX_PER_USER_LIMIT} units allowed`);
            }
            cart.items.push({ product: productId, variant: targetVariant, qty, price: finalPrice });
        }
    }

    await cart.save();
    return cart.items.length;
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
    if (newQty > MAX_PER_USER_LIMIT) {
        throw new Error(`Cannot exceed maximum limit of ${MAX_PER_USER_LIMIT}`);
    }

    // Stock check for specific variant
    let stock = item.product.stock || 0;
    const productVariants = item.product.variants;

    if (productVariants?.length > 0) {
        const matched = findMatchingVariant(productVariants, item.variant);
        if (!matched && item.variant) {
            // The variant this item was referencing has been soft-deleted
            throw new Error("This item's variant is no longer available. Please remove it from your cart.");
        }
        if (matched) {
            stock = matched.stock;
        }
    }
    
    if (newQty > stock) {
        throw new Error("Cannot exceed available stock");
    }

    item.qty = newQty;
    await cart.save();

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
        itemTotal: item.qty * item.price,
        cartSubtotal: cart.subtotal,
        hasIssues,
        itemStatus: {
            isUnavailable: !item.product || item.product.isBlocked || !item.product.isListed,
            isOutOfStock: stock <= 0,
            insufficientStock: item.qty > stock,
            availableStock: stock
        }
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

    return {
        cartSubtotal: cart.subtotal,
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
