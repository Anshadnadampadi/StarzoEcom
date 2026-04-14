import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/Product.js";
import { isSameVariant, findMatchingVariant, getVariantDisplayString } from "../../utils/productHelpers.js";

/**
 * Service to handle cart operations
 */
export const getCartData = async (userId) => {
    let cart = await Cart.findOne({ userId }).populate("items.product").lean();

    if (cart && cart.items.length > 0) {
        // Filter out items with unavailable products
        cart.items = cart.items.filter(item => {
            if (!item.product) return false;
            return item.product.isBlocked !== true && item.product.isListed !== false;
        });

        // Add dynamic fields like display image and formatted variant string for UI
        cart.items = cart.items.map(item => {
            let displayImage = '/images/placeholder.jpg';
            const product = item.product;
            const currentVariant = item.variant;

            // Use first variant image as default
            if (product.variants?.length > 0) {
                const defaultVariant = product.variants[0];
                if (defaultVariant.images?.length > 0) {
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

            return { 
                ...item, 
                variantDisplay: getVariantDisplayString(currentVariant),
                displayImage 
            };
        });
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
    // Handle potential legacy string input or missing fields
    let targetVariant = typeof variant === 'string' ? null : variant; 
    // If it's a string, we might need a way to parse it, but the goal is to stop using strings.
    // For now, if it's not an object, we'll try to use the first variant as default.
    
    let price = product.price;
    let stock = product.stock || 0;

    // Find matching variant from product data to get correct price and stock
    const matchedVariant = findMatchingVariant(product.variants, targetVariant);
    
    if (matchedVariant) {
        // If we found a match, use its specific data
        targetVariant = {
            color: matchedVariant.color || "",
            storage: matchedVariant.storage || "",
            ram: matchedVariant.ram || ""
        };
        price = matchedVariant.price;
        stock = matchedVariant.stock;
    } else if (product.variants?.length > 0) {
        // If no variant provided or matched, but product has variants, use the first one
        const fallback = product.variants[0];
        targetVariant = {
            color: fallback.color || "",
            storage: fallback.storage || "",
            ram: fallback.ram || ""
        };
        price = fallback.price;
        stock = fallback.stock;
    } else {
        // For products without variants, use empty variant object
        targetVariant = { color: "", storage: "", ram: "" };
    }

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
            cart.items[itemIndex].price = price; // Update price in case it's changed
        } else {
            // Add new item if no match found
            if (qty > MAX_PER_USER_LIMIT) {
                throw new Error(`Limit reached: Maximum ${MAX_PER_USER_LIMIT} units allowed`);
            }
            cart.items.push({ product: productId, variant: targetVariant, qty, price });
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
        if (matched) {
            stock = matched.stock;
        }
    }
    
    if (newQty > stock) {
        throw new Error("Cannot exceed available stock");
    }

    item.qty = newQty;
    await cart.save();

    return {
        newQty: item.qty,
        itemTotal: item.qty * item.price,
        cartSubtotal: cart.subtotal
    };
};

export const removeItem = async (userId, itemId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
        throw new Error("Cart not found");
    }

    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    await cart.save();

    return {
        cartSubtotal: cart.subtotal,
        isEmpty: cart.items.length === 0
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
