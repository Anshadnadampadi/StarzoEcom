// services/user/couponService.js

import mongoose from "mongoose";
import Coupon from "../../models/coupon/coupon.js";
import Cart from "../../models/cart/cart.js";




export const applyCouponService = async (userId, codeOrId) => {
    let query = { isActive: true };
    if (mongoose.Types.ObjectId.isValid(codeOrId)) {
        query._id = codeOrId;
    } else {
        query.code = codeOrId ? codeOrId.trim().toUpperCase() : '';
    }
    const coupon = await Coupon.findOne(query);

    if (!coupon) throw new Error("Invalid or inactive coupon");

    // Expiry check
    if (new Date(coupon.expiryDate) < new Date()) {
        throw new Error("Coupon expired");
    }

    // Check usage limit
    if (coupon.usageLimit <= coupon.usedBy.length) {
        throw new Error("Coupon usage limit reached");
    }

    // Check if user already used
    if (coupon.usedBy.some(id => id.toString() === userId.toString())) {
        throw new Error("You already used this coupon");
    }

    // Get cart
    const cart = await Cart.findOne({ userId }).populate("items.product");

    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
    }

    // ── Discount Calculation with Safety Limit ──
    const cartTotal = cart.subtotal || 0;
    const originalTotal = cart.originalSubtotal || cartTotal;
    const currentOfferDiscount = Math.max(0, originalTotal - cartTotal);
    
    // Safety limit: Total discount (Offer + Coupon) cannot exceed 50% of original price
    const MAX_TOTAL_DISCOUNT_PERCENT = 50; 
    const maxAllowedTotalDiscount = Math.floor(originalTotal * (MAX_TOTAL_DISCOUNT_PERCENT / 100));
    const remainingDiscountGap = Math.max(0, maxAllowedTotalDiscount - currentOfferDiscount);

    // Minimum amount check
    if (cartTotal < coupon.minAmount) {
        throw new Error(`Minimum purchase ₹${coupon.minAmount} required`);
    }

    let potentialDiscount = 0;
    if (coupon.discountType === "percentage") {
        potentialDiscount = Math.floor((cartTotal * coupon.discountValue) / 100);
    } else {
        potentialDiscount = coupon.discountValue;
    }

    // Max discount cap defined on the coupon itself
    if (coupon.maxDiscount && potentialDiscount > coupon.maxDiscount) {
        potentialDiscount = coupon.maxDiscount;
    }

    // ENFORCE GLOBAL OVER-DISCOUNTING LIMIT
    const finalDiscount = Math.min(potentialDiscount, remainingDiscountGap);

    if (finalDiscount <= 0 && potentialDiscount > 0) {
        throw new Error("This coupon cannot be combined with existing offers as the maximum total discount limit (50%) has already been reached.");
    }

    if (finalDiscount < potentialDiscount) {
        // The discount was capped by the safety limit, but is still > 0
        // We allow it, but finalDiscount will be the capped value
    }

    const finalAmount = cartTotal - finalDiscount;

    // Save coupon in cart
    cart.coupon = coupon._id;
    cart.discount = finalDiscount;
    cart.finalAmount = finalAmount;

    await cart.save();

    return {
        cartTotal,
        discount: finalDiscount,
        finalAmount
    };
};


export const removeCouponService = async (userId) => {

    const cart = await Cart.findOne({ userId });

    if (!cart) throw new Error("Cart not found");

    cart.coupon = null;
    cart.discount = 0;
    cart.finalAmount = cart.subtotal;

    await cart.save();

    return {
        finalAmount: cart.subtotal
    };
};

export const getAvailableCouponsService = async (userId) => {
    // Check if user has any previous orders
    const Order = await import("../../models/order/order.js").then(m => m.default);
    const hasOrders = await Order.exists({ user: userId, orderStatus: { $ne: 'Cancelled' } });

    const query = {
        isActive: true,
        expiryDate: { $gt: new Date() },
        usedBy: { $ne: userId }
    };

    if (hasOrders) {
        query.isFirstTimeUser = false;
    }

    const coupons = await Coupon.find(query).sort({ createdAt: -1 }).lean();
    
    // Filter out coupons that have reached their usage limit
    return coupons.filter(c => (c.usedBy ? c.usedBy.length : 0) < (c.usageLimit || 1));
};