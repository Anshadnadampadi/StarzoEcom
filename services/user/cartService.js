import Cart from "../../models/cart/Cart.js";
import Product from "../../models/product/product.js";

const normalizeUnit = (s) => {
    if (!s) return "";
    let v = s.toString().trim();
    if (/^\d+$/.test(v)) return v + " GB";
    if (v.toLowerCase().endsWith("gb")) return v.slice(0, -2).trim() + " GB";
    return v;
};

const getVariantString = (v) => {
    return `${normalizeUnit(v.storage)} ${(v.color || "").trim()} ${normalizeUnit(v.ram)}`.trim();
};

const canonicalize = (s) => (s || "").replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Service to handle cart operations
 */
export const getCartData = async (userId) => {
    let cart = await Cart.findOne({ userId }).populate("items.product").lean();
    
    if (cart && cart.items.length > 0) {
        cart.items = cart.items.filter(item => {
            if (!item.product) return false;
            const isBlocked = item.product.isBlocked === true;
            const isListed = item.product.isListed !== false; 
            return !isBlocked && isListed;
        });

        // Add variant image logic
        cart.items = cart.items.map(item => {
            let displayImage = '/images/placeholder.jpg';
            
            // Use first variant image as default if available
            if (item.product.variants && item.product.variants.length > 0 && item.product.variants[0].images && item.product.variants[0].images.length > 0) {
                displayImage = item.product.variants[0].images[0];
            }
            
            if (item.variant && item.product.variants && item.product.variants.length > 0) {
                const matchedVariant = item.product.variants.find(v => canonicalize(getVariantString(v)) === canonicalize(item.variant));
                if (matchedVariant && matchedVariant.images && matchedVariant.images.length > 0) {
                    displayImage = matchedVariant.images[0];
                }
            }
            return { ...item, displayImage };
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

    let stock = product.stock || 0;
    let price = product.price;
    let finalVariant = variant;

    // Default to first variant if none specified but variants exist
    if (!finalVariant && product.variants && product.variants.length > 0) {
        const def = product.variants[0];
        finalVariant = getVariantString(def);
        price = def.price;
        stock = def.stock;
    }

    if (finalVariant && product.variants && product.variants.length > 0) {
        const matchedVariant = product.variants.find(
            v => canonicalize(getVariantString(v)) === canonicalize(finalVariant)
        );

        if (!matchedVariant) {
            throw new Error("Selected variant is not available");
        }

        price = matchedVariant.price;
        stock = matchedVariant.stock;
    }

    if (stock < 1 || stock < qty) {
        throw new Error("Insufficient stock");
    }

    const MAX_PER_USER_LIMIT = 5;

    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
        if (qty > MAX_PER_USER_LIMIT) {
            throw new Error(`You can only add up to ${MAX_PER_USER_LIMIT} units of this item`);
        }
        cart = new Cart({
            userId,
            items: [{ product: productId, variant: finalVariant, qty, price }]
        });
    } else {
        const itemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId && item.variant === finalVariant
        );

        if (itemIndex > -1) {
            let newQty = cart.items[itemIndex].qty + Number(qty);
            
            if (newQty > MAX_PER_USER_LIMIT) {   
                throw new Error(`Limit reached, you can only order up to ${MAX_PER_USER_LIMIT} units of this item`);
            }
            
            if (newQty > stock) {
                throw new Error("Cannot add more than available stock");
            }

            cart.items[itemIndex].qty = newQty;
            cart.items[itemIndex].price = price;
        } else {
            if (qty > MAX_PER_USER_LIMIT) {
                throw new Error(`You can only add up to ${MAX_PER_USER_LIMIT} units of this item`);
            }
            cart.items.push({ product: productId, variant: finalVariant, qty, price });
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

    let stock = item.product.stock;

if (item.variant && item.product.variants?.length > 0) {
    const matchedVariant = item.product.variants.find(
        v => canonicalize(getVariantString(v)) === canonicalize(item.variant)
    );

    if (matchedVariant) {
        stock = matchedVariant.stock;
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
