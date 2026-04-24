import Offer from '../../models/offer/offer.js';

/**
 * Calculates the best available offer for a product.
 * Returns the offer object and the discounted price.
 */
export const getBestOfferForProduct = async (product) => {
    const now = new Date();
    
    // Find active offers for this product or its category
    const offers = await Offer.find({
        isActive: true,
        expiryDate: { $gt: now },
        $or: [
            { type: 'Product', productId: product._id },
            { type: 'Category', categoryId: product.category }
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

        if (discount > bestDiscount) {
            bestDiscount = discount;
            bestOffer = offer;
        }
    });

    const discountedPrice = Math.max(0, product.price - bestDiscount);
    
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
        expiryDate: { $gt: now }
    });

    return products.map(product => {
        const prodId = product._id.toString();
        const catId = product.category?._id?.toString() || product.category?.toString();

        const relevantOffers = activeOffers.filter(offer => 
            (offer.type === 'Product' && offer.productId && offer.productId.toString() === prodId) ||
            (offer.type === 'Category' && offer.categoryId && offer.categoryId.toString() === catId)
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

            if (discount > bestDiscount) {
                bestDiscount = discount;
                bestOffer = offer;
            }
        });

        const discountedPrice = Math.max(0, product.price - bestDiscount);
        
        return {
            ...product,
            bestOffer,
            discountedPrice: Math.floor(discountedPrice),
            hasOffer: bestDiscount > 0
        };
    });
};
