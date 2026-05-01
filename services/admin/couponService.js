
import Coupon from "../../models/coupon/coupon.js";

export const createCouponService = async (data) => {

    let {
        code,
        discountType,
        discountValue,
        minAmount,
        maxDiscount,
        expiryDate,
        usageLimit
    } = data;

    //  Normalize
    code= code?.trim().toUpperCase();

    //  Code validation
    if (!code || !/^[A-Z0-9]{4,15}$/.test(code)) {
        throw new Error("Invalid coupon code (4–15 uppercase chars)");
    }
    //  Type
    if (!["fixed", "percentage"].includes(discountType)) {
        throw new Error("Invalid discount type");
    }

    //  Discount
    discountValue = Number(discountValue);
    if (!discountValue || discountValue <= 0) {
        throw new Error("Discount must be greater than 0");
    }

    if (discountType === "percentage" && discountValue > 100) {
        throw new Error("Percentage cannot exceed 100");
    }

    //  Min amount
    minAmount = Number(minAmount || 0);
    if (minAmount < 0) {
        throw new Error("Minimum amount cannot be negative");
    }

    if (discountType === "fixed" && discountValue >= minAmount) {
        throw new Error("Discount amount must be lower than the minimum purchase price");
    }


    //  Max discount
    if (maxDiscount !== undefined && maxDiscount !== "") {
        maxDiscount = Number(maxDiscount);
        if (maxDiscount < 0) {
            throw new Error("Max discount cannot be negative");
        }
    } else {
        maxDiscount = null;
    }

    if (discountType === "percentage" && !maxDiscount) {
        throw new Error("Max discount required for percentage coupons");
    }

    if (discountType === "percentage" && maxDiscount >= minAmount) {
        throw new Error("Max discount must be lower than the minimum purchase price");
    }

    //Expiry
    const expiry = new Date(expiryDate);
    expiry.setHours(23, 59, 59, 999); // Set to end of day

    const now = new Date();
    // Allow today, but not past days
    if (!expiryDate || isNaN(expiry.getTime()) || expiry < now) {
        throw new Error("Expiry must be today or a future date");
    }

    //  Usage limit
    usageLimit = Number(usageLimit);
    if (!usageLimit || usageLimit < 1) {
        throw new Error("Usage limit must be at least 1");
    }

    //  Unique
    const existing = await Coupon.findOne({ code });
    if (existing) {
        throw new Error("Coupon already exists");
    }

    //  Create
    return await Coupon.create({
        code,
        discountType,
        discountValue,
        minAmount,
        maxDiscount,
        expiryDate: expiry,
        usageLimit
    });
};

export const getCouponService = async (query) => {

    const { search = "", page = 1, limit = 10 } = query;

    const filter = {
        code: { $regex: search, $options: "i" }
    };

    return await Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));
};

export const updateCouponService = async (id, data) => {

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new Error("Coupon not found");

    const isUsed = coupon.usedBy && coupon.usedBy.length > 0;

    let {
        code,
        discountType,
        discountValue,
        minAmount,
        maxDiscount,
        expiryDate,
        usageLimit
    } = data;

    //  Normalize
    code = code?.trim().toUpperCase();

    //  If used, prevent changing core offer details
    if (isUsed) {
        if (code !== undefined && code !== coupon.code) throw new Error("Cannot change the code of a used coupon");
        if (discountType !== undefined && discountType !== coupon.discountType) throw new Error("Cannot change the discount type of a used coupon");
        if (discountValue !== undefined && Number(discountValue) !== coupon.discountValue) throw new Error("Cannot change the discount value of a used coupon");
    }
    // Code validation
    if (code && !/^[A-Z0-9]{4,15}$/.test(code)) {
        throw new Error("Invalid coupon code (4–15 uppercase chars)");
    }

    //  Type
    if (discountType && !["fixed", "percentage"].includes(discountType)) {
        throw new Error("Invalid discount type");
    }

    // Discount
    if (discountValue !== undefined) {
        discountValue = Number(discountValue);
        if (discountValue <= 0) {
            throw new Error("Discount must be greater than 0");
        }
        const currentType = discountType || coupon.discountType;
        if (currentType === "percentage" && discountValue > 100) {
            throw new Error("Percentage cannot exceed 100");
        }
        
        const currentMinAmount = minAmount !== undefined ? minAmount : coupon.minAmount;
        if (currentType === "fixed" && discountValue >= currentMinAmount) {
            throw new Error("Discount amount must be lower than the minimum purchase price");
        }
    }


    //  Min amount
    if (minAmount !== undefined) {
        minAmount = Number(minAmount);
        if (minAmount < 0) {
            throw new Error("Minimum amount cannot be negative");
        }
        
        const currentType = discountType || coupon.discountType;
        const currentDiscountValue = discountValue !== undefined ? discountValue : coupon.discountValue;
        
        if (currentType === "fixed" && currentDiscountValue >= minAmount) {
            throw new Error("Discount amount must be lower than the minimum purchase price");
        }
    }
    //  Max discount
    if (maxDiscount !== undefined) {
        if (maxDiscount !== "" && maxDiscount !== null) {
            maxDiscount = Number(maxDiscount);
            if (maxDiscount < 0) {
                throw new Error("Max discount cannot be negative");
            }
        } else {
            maxDiscount = null;
        }
    }

    const currentType = discountType || coupon.discountType;
    const currentMaxDiscount = maxDiscount !== undefined ? maxDiscount : coupon.maxDiscount;

    if (currentType === "percentage" && !currentMaxDiscount) {
        throw new Error("Max discount required for percentage coupons");
    }

    const currentMinAmount = minAmount !== undefined ? minAmount : coupon.minAmount;
    if (currentType === "percentage" && currentMaxDiscount >= currentMinAmount) {
        throw new Error("Max discount must be lower than the minimum purchase price");
    }

    // Expiry
    let expiry = coupon.expiryDate;
    if (expiryDate) {
        expiry = new Date(expiryDate);
        expiry.setHours(23, 59, 59, 999);
        const now = new Date();
        if (isNaN(expiry.getTime()) || expiry < now) {
            throw new Error("Expiry must be today or a future date");
        }
    }
    //  Usage limit
    if (usageLimit !== undefined) {
        usageLimit = Number(usageLimit);
        if (usageLimit < 1) {
            throw new Error("Usage limit must be at least 1");
        }
    }

    // Unique
    if (code) {
        const existing = await Coupon.findOne({ code, _id: { $ne: id } });
        if (existing) {
            throw new Error("Coupon already exists");
        }
    }

    // Apply updates
    if (code !== undefined) coupon.code = code;
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (minAmount !== undefined) coupon.minAmount = minAmount;
    if (maxDiscount !== undefined) coupon.maxDiscount = maxDiscount;
    if (expiryDate !== undefined) coupon.expiryDate = expiry;
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit;

    await coupon.save();
    return coupon;
};

//toggle the coupon active and inactive
export const toggleCouponStatusService = async (id) => {

    const coupon = await Coupon.findById(id);
    if (!coupon) throw new Error("Coupon not found");

    coupon.isActive = !coupon.isActive;

    await coupon.save();

    return coupon;
};

//delete the coupon
export const deleteCouponService = async (id) => {
    const coupon = await Coupon.findById(id);
    if (!coupon) throw new Error("Coupon not found");
    
    // Check if coupon is already used, maybe prevent deletion?
    if (coupon.usedBy && coupon.usedBy.length > 0) {
        throw new Error("Cannot delete a coupon that has already been used");
    }

    await Coupon.findByIdAndDelete(id);
    return true;
};