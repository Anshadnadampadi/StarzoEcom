
import Coupon from "../../models/coupon/coupon.js";
import product from "../../models/product/product.js";
import cart from "../../models/cart/Cart.js"

export const createCouponService = async (data) => {

    let {
        code,
        discountType,
        discountValue,
        minAmount,
        maxDiscount,
        expiryDate,
        usageLimit,
        perUserLimit
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

    if (discountType === "percentage" && discountValue > 90) {
        throw new Error("Offer percentage too high");
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

    //  Usage limit (global)
    usageLimit = Number(usageLimit);
    if (!usageLimit || usageLimit < 1) {
        throw new Error("Usage limit must be at least 1");
    }

    //  Per-user limit
    perUserLimit = Number(perUserLimit || 1);
    if (perUserLimit < 1) {
        throw new Error("Per-user limit must be at least 1");
    }
    if (perUserLimit > usageLimit) {
        throw new Error("Per-user limit cannot exceed the total usage limit");
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
        usageLimit,
        perUserLimit
    });
};

export const getCouponService = async (query) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, parseInt(query.limit) || 5);
    const search = query.search || "";
    const tab = query.tab || "live";
    
    const filter = {
        code: { $regex: search, $options: "i" }
    };

    if (tab === "live") {
        filter.expiryDate = { $gte: new Date() };
    } else if (tab === "archived") {
        filter.expiryDate = { $lt: new Date() };
    }

    const skip = (page - 1) * limit;
    
    const [coupons, totalCoupons] = await Promise.all([
        Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Coupon.countDocuments(filter)
    ]);

    return {
        coupons,
        totalPages: Math.ceil(totalCoupons / limit),
        totalCoupons,
        currentPage: page,
        tab
    };
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
        usageLimit,
        perUserLimit
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
        if (currentType === "percentage" && discountValue > 90) {
            throw new Error("Offer percentage too high");
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
    //  Usage limit (global)
    if (usageLimit !== undefined) {
        usageLimit = Number(usageLimit);
        if (usageLimit < 1) {
            throw new Error("Usage limit must be at least 1");
        }
    }

    //  Per-user limit
    if (perUserLimit !== undefined) {
        perUserLimit = Number(perUserLimit);
        if (perUserLimit < 1) {
            throw new Error("Per-user limit must be at least 1");
        }
        const currentUsageLimit = usageLimit !== undefined ? usageLimit : coupon.usageLimit;
        if (perUserLimit > currentUsageLimit) {
            throw new Error("Per-user limit cannot exceed the total usage limit");
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
    if (perUserLimit !== undefined) coupon.perUserLimit = perUserLimit;

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



