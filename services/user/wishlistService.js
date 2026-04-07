
import Wishlist from "../../models/wishlist/wishlist.js";
import Cart from "../../models/cart/Cart.js"


export const getWishlist = async (userId) => {

    const wishlist = await Wishlist.findOne({ userId })
        .populate("items.productId");

    if (!wishlist) return [];

    //  Attach correct variant details
    const formatted = wishlist.items.map(item => {
        const product = item.productId;

        const selectedVariant = product.variants.find(v =>
            v.color === item.variant.color &&
            v.storage === item.variant.storage &&
            v.ram === item.variant.ram
        );

        return {
            productId: product._id,
            name: product.name,
            brand: product.brand,

            variant: item.variant,

            price: selectedVariant?.price || product.price,
            stock: selectedVariant?.stock || product.stock,
            image: selectedVariant?.images?.[0] || null
        };
    });

    return formatted;
};

export const addToWishlist = async (userId, productId, variant) => {

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
        wishlist = new Wishlist({
            userId,
            items: [{ productId, variant }]
        });
        return await wishlist.save();
    }

    //  Check duplicate (product + variant)
    const exists = wishlist.items.find(item =>
        item.productId.toString() === productId &&
        item.variant.color === variant.color &&
        item.variant.storage === variant.storage &&
        item.variant.ram === variant.ram
    );

    if (exists) {
        throw new Error("Product already in wishlist");
    }

    wishlist.items.push({ productId, variant });

    return await wishlist.save();
};

export const removeFromWishlist = async (userId, productId, variant) => {

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) throw new Error("Wishlist not found");

    wishlist.items = wishlist.items.filter(item =>
        !(
            item.productId.toString() === productId &&
            item.variant.color === variant.color &&
            item.variant.storage === variant.storage &&
            item.variant.ram === variant.ram
        )
    );

    return await wishlist.save();
};

// move to cart from wishlist

export const moveToCart = async (userId, productId, variant) => {

    // Add to cart
    await Cart.findOneAndUpdate(
        { userId },
        {
            $addToSet: {
                items: {
                    productId,
                    quantity: 1,
                    variant
                }
            }
        },
        { upsert: true }
    );

    //  Remove from wishlist
    await removeFromWishlist(userId, productId, variant);
};