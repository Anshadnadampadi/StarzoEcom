import Offer from "../../models/offer/offer.js";

export const createOfferService = async (data) => {
    let {
        name,
        type,
        discountType,
        discountValue,
        productId,
        categoryId,
        expiryDate
    } = data;

    //  Name
    if (!name || name.trim().length < 3) {
        throw new Error("Offer name must be at least 3 characters");
    }

    // Type
    if (!['Product', 'Category'].includes(type)) {
        throw new Error("Invalid offer type");
    }

    //  Discount Type
    if (!['percentage', 'fixed'].includes(discountType)) {
        throw new Error("Invalid discount type");
    }

    // Discount Value
    discountValue = Number(discountValue);
    if (!discountValue || discountValue <= 0) {
        throw new Error("Discount value must be greater than 0");
    }

    if (discountType === 'percentage' && discountValue > 99) {
        throw new Error("Percentage discount cannot exceed 99%");
    }

    //  Association
    if (type === 'Product' && !productId) {
        throw new Error("Product must be selected for Product Offer");
    }
    if (type === 'Category' && !categoryId) {
        throw new Error("Category must be selected for Category Offer");
    }

    //  Expiry
    const expiry = new Date(expiryDate);
    expiry.setHours(23, 59, 59, 999);
    if (isNaN(expiry.getTime()) || expiry < new Date()) {
        throw new Error("Expiry date must be in the future");
    }

    //  Unique Offer Check (Optional: Allow multiple but maybe warn or just take best)
    // For now, let's just create it. The 'best offer' logic handles overlaps.

    return await Offer.create({
        name: name.trim(),
        type,
        discountType,
        discountValue,
        productId: type === 'Product' ? (productId || null) : null,
        categoryId: type === 'Category' ? (categoryId || null) : null,
        expiryDate: expiry
    });
};

export const getOffersService = async (query = {}) => {
    const { search = "", page = 1, limit = 10 } = query;
    const filter = {
        name: { $regex: search, $options: "i" }
    };

    return await Offer.find(filter)
        .populate('productId', 'name')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));
};

export const updateOfferService = async (id, data) => {
    const offer = await Offer.findById(id);
    if (!offer) throw new Error("Offer not found");

    let {
        name,
        type,
        discountType,
        discountValue,
        productId,
        categoryId,
        expiryDate
    } = data;

    if (name) offer.name = name.trim();
    if (type) offer.type = type;
    if (discountType) offer.discountType = discountType;
    if (discountValue) offer.discountValue = Number(discountValue);
    
    if (type === 'Product') {
        offer.productId = productId || null;
        offer.categoryId = null;
    } else if (type === 'Category') {
        offer.categoryId = categoryId || null;
        offer.productId = null;
    }

    if (expiryDate) {
        const expiry = new Date(expiryDate);
        expiry.setHours(23, 59, 59, 999);
        offer.expiryDate = expiry;
    }

    await offer.save();
    return offer;
};

export const toggleOfferStatusService = async (id) => {
    const offer = await Offer.findById(id);
    if (!offer) throw new Error("Offer not found");

    offer.isActive = !offer.isActive;
    await offer.save();
    return offer;
};

export const deleteOfferService = async (id) => {
    const offer = await Offer.findById(id);
    if (!offer) throw new Error("Offer not found");

    await Offer.findByIdAndDelete(id);
    return true;
};
