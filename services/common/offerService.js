import Offer from '../../models/offer/offer.js';

/**
 * Calculates the best available offer for a product.
 * Returns the offer object and the discounted price.
 */
export const getBestOfferForProduct = async (product) => {
    const now = new Date();
    
    const prodId = product._id;
    const catId = product.category?._id || product.category;

    // Find active offers for this product or its category
    const offers = await Offer.find({
        isActive: true,
        expiryDate: { $gt: now },
        startDate: { $lte: now },
        $or: [
            { type: 'Product', productIds: prodId },
            { type: 'Category', categoryIds: catId }
        ]
    });

    if (offers.length === 0) return { bestOffer: null, discountedPrice: product.price };

    let bestDiscount = 0;
    let bestOffer = null;

    offers.forEach(offer => {
        let discount = 0;
        if (offer.discountType === 'percentage') {
            discount = (product.price * offer.discountValue) / 100;
        } else {
            discount = offer.discountValue;
        }

        // Apply cap if defined (now for both percentage and fixed)
        if (offer.maxDiscountAmount && discount > offer.maxDiscountAmount) {
            discount = offer.maxDiscountAmount;
        }

        if (discount > bestDiscount) {
            bestDiscount = discount;
            bestOffer = offer;
        }
    });

    // Ensure price doesn't drop to 0 or negative. 
    // Absolute minimum is ₹1, but we should also cap total discount at 95% of original price as a safety net.
    const maxSafetyDiscount = product.price * 0.95;
    const finalDiscount = Math.min(bestDiscount, maxSafetyDiscount);
    const discountedPrice = Math.max(1, product.price - finalDiscount);
    
    return {
        bestOffer,
        discountedPrice: Math.floor(discountedPrice),
        discountAmount: Math.floor(bestDiscount)
    };
};

/**
 * Helper to apply offers to a list of products (e.g. for listing pages)
 */
export const applyOffersToProducts = async (products) => {
    const now = new Date();
    const activeOffers = await Offer.find({
        isActive: true,
        expiryDate: { $gt: now },
        startDate: { $lte: now }
    });

    return products.map(product => {
        const prodId = product._id.toString();
        const catId = product.category?._id?.toString() || product.category?.toString();

        const relevantOffers = activeOffers.filter(offer => 
            (offer.type === 'Product' && offer.productIds && offer.productIds.some(id => id.toString() === prodId)) ||
            (offer.type === 'Category' && offer.categoryIds && offer.categoryIds.some(id => id.toString() === catId))
        );

        let bestDiscount = 0;
        let bestOffer = null;

        relevantOffers.forEach(offer => {
            let discount = 0;
            if (offer.discountType === 'percentage') {
                discount = (product.price * offer.discountValue) / 100;
            } else {
                discount = offer.discountValue;
            }

            // Apply cap if defined
            if (offer.maxDiscountAmount && discount > offer.maxDiscountAmount) {
                discount = offer.maxDiscountAmount;
            }

            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestOffer = offer;
            }
        });

        // Ensure price doesn't drop to 0 or negative
        const maxSafetyDiscount = product.price * 0.95;
        const finalDiscount = Math.min(bestDiscount, maxSafetyDiscount);
        const discountedPrice = Math.max(1, product.price - finalDiscount);
        
        return {
            ...product,
            bestOffer,
            discountedPrice: Math.floor(discountedPrice),
            hasOffer: bestDiscount > 0
        };
    });
};
