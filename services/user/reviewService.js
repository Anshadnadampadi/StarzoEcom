import mongoose from "mongoose";
import Review from "../../models/product/Review.js";
import Order from "../../models/order/order.js";

/**
 * Check if a user can review a product (bought and delivered)
 */
export const canUserReview = async (userId, productId) => {
    try {
        console.log(`[ELIGIBILITY_CHECK] User: ${userId}, Product: ${productId}`);
        
        // Check if there is an order from this user containing this product with status 'Delivered'
        const deliveredOrder = await Order.findOne({
            user: userId,
            items: {
                $elemMatch: {
                    product: productId,
                    status: 'Delivered'
                }
            }
        });

        console.log(`[ELIGIBILITY_RESULT] User: ${userId}, Product: ${productId}, Found: ${!!deliveredOrder}`);
        return !!deliveredOrder;
    } catch (error) {
        console.error("Error checking review eligibility:", error);
        return false;
    }
};

/**
 * Add or Update a review
 */
export const addReview = async (userId, productId, { rating, comment, images }) => {
    const isVerifiedPurchase = await canUserReview(userId, productId);
    
    return await Review.findOneAndUpdate(
        { userId, productId },
        { 
            rating, 
            comment, 
            images: images || [], 
            isVerifiedPurchase 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
};

/**
 * Get all reviews for a product with user details
 */
export const getProductReviews = async (productId) => {
    return await Review.find({ productId })
        .populate('userId', 'firstName lastName name profileImage')
        .sort({ createdAt: -1 })
        .lean();
};

/**
 * Calculate average rating for a product
 */
export const getAverageRating = async (productId) => {
    const result = await Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);
    
    return result[0] || { average: 0, count: 0 };
};

/**
 * Apply review stats (average rating, review count) to a list of products
 */
export const applyReviewsToProducts = async (products) => {
    if (!products || products.length === 0) return products;

    const productIds = products.map(p => new mongoose.Types.ObjectId(p._id));
    const reviewsAgg = await Review.aggregate([
        { $match: { productId: { $in: productIds } } },
        { $group: { _id: "$productId", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);

    const reviewMap = {};
    reviewsAgg.forEach(r => {
        reviewMap[r._id.toString()] = {
            averageRating: r.averageRating,
            reviewCount: r.reviewCount
        };
    });

    return products.map(p => {
        const stats = reviewMap[p._id.toString()] || { averageRating: 0, reviewCount: 0 };
        return { ...p, ...stats };
    });
};
