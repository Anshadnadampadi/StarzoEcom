import Offer from "../../models/offer/offer.js";

export const createOfferService = async (data) => {
    let {
        name,
        type,
        discountType,
        discountValue,
        productIds,
        categoryIds,
        expiryDate,
        startDate,
        maxDiscountAmount
    } = data;

    // Validation
    if (!name || name.trim().length < 3) {
        throw new Error("Offer name must be at least 3 characters");
    }

    if (!['Product', 'Category'].includes(type)) {
        throw new Error("Invalid offer type");
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
        throw new Error("Invalid discount type");
    }

    discountValue = Number(discountValue);
    if (!discountValue || discountValue <= 0) {
        throw new Error("Discount value must be greater than 0");
    }

    if (discountType === 'percentage' && discountValue > 90) {
        throw new Error("Offer percentage too high");
    }

    if (type === 'Product' && (!productIds || productIds.length === 0)) {
        throw new Error("At least one product must be selected for Product Offer");
    }
    if (type === 'Category' && (!categoryIds || categoryIds.length === 0)) {
        throw new Error("At least one category must be selected for Category Offer");
    }

    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0); // Start of the day

    const expiry = new Date(expiryDate);
    expiry.setHours(23, 59, 59, 999); // End of the day

    if (isNaN(expiry.getTime()) || expiry < start) {
        throw new Error("Expiry date must be on or after the start date");
    }

    const duplicateName = await Offer.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    if (duplicateName) {
        throw new Error("An offer with this name already exists");
    }

    // Overlap Check
    const overlapFilter = { 
        isActive: true, 
        type,
        expiryDate: { $gt: new Date() }
    };
    if (type === 'Product') {
        overlapFilter.productIds = { $in: productIds };
    } else {
        overlapFilter.categoryIds = { $in: categoryIds };
    }

    const existingOffer = await Offer.findOne(overlapFilter);
    if (existingOffer) {
        const target = type === 'Product' ? "one or more selected products" : "one or more selected categories";
        throw new Error(`Conflict: Offer "${existingOffer.name}" is already active for ${target}`);
    }

    return await Offer.create({
        name: name.trim(),
        type,
        discountType,
        discountValue,
        productIds: type === 'Product' ? productIds : [],
        categoryIds: type === 'Category' ? categoryIds : [],
        startDate: start,
        expiryDate: expiry,
        maxDiscountAmount: maxDiscountAmount || null
    });
};

export const getOffersService = async (query = {}) => {
    const { search = "", page = 1, limit = 10 } = query;
    const filter = {
        name: { $regex: search, $options: "i" }
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [offers, totalOffers] = await Promise.all([
        Offer.find(filter)
            .populate('productIds', 'name')
            .populate('categoryIds', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Offer.countDocuments(filter)
    ]);

    return {
        offers,
        totalPages: Math.ceil(totalOffers / limit),
        totalOffers,
        currentPage: Number(page)
    };
};

export const updateOfferService = async (id, data) => {
    const offer = await Offer.findById(id);
    if (!offer) throw new Error("Offer not found");

    let {
        name,
        type,
        discountType,
        discountValue,
        productIds,
        categoryIds,
        expiryDate,
        startDate,
        maxDiscountAmount
    } = data;

    const newName = name ? name.trim() : offer.name;
    const newType = type || offer.type;
    const newDiscountType = discountType || offer.discountType;
    const newDiscountValue = discountValue !== undefined ? Number(discountValue) : offer.discountValue;
    
    let newProductIds = offer.productIds;
    let newCategoryIds = offer.categoryIds;

    // Validation
    if (discountType === 'percentage' && Number(discountValue) > 90) {
        throw new Error("Offer percentage too high");
    }

    if (type) {
        if (type === 'Product') {
            newProductIds = productIds || [];
            newCategoryIds = [];
        } else if (type === 'Category') {
            newCategoryIds = categoryIds || [];
            newProductIds = [];
        }
    } else {
        if (newType === 'Product' && productIds) newProductIds = productIds;
        if (newType === 'Category' && categoryIds) newCategoryIds = categoryIds;
    }

    if (name && name.trim().toLowerCase() !== offer.name.toLowerCase()) {
        const duplicateName = await Offer.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: id }
        });
        if (duplicateName) throw new Error("An offer with this name already exists");
    }

    // Overlap Check for Update
    if (offer.isActive) {
        const overlapFilter = { 
            isActive: true, 
            type: newType,
            _id: { $ne: id },
            expiryDate: { $gt: new Date() }
        };
        
        if (newType === 'Product') {
            overlapFilter.productIds = { $in: newProductIds };
        } else {
            overlapFilter.categoryIds = { $in: newCategoryIds };
        }

        const existingOffer = await Offer.findOne(overlapFilter);
        if (existingOffer) {
            const target = newType === 'Product' ? "selected products" : "selected categories";
            throw new Error(`Conflict: Offer "${existingOffer.name}" is already active for these ${target}`);
        }
    }

    offer.name = newName;
    offer.type = newType;
    offer.discountType = newDiscountType;
    offer.discountValue = newDiscountValue;
    offer.productIds = newProductIds;
    offer.categoryIds = newCategoryIds;

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        offer.startDate = start;
    }

    if (expiryDate) {
        const expiry = new Date(expiryDate);
        expiry.setHours(23, 59, 59, 999);
        offer.expiryDate = expiry;
    }

    offer.maxDiscountAmount = maxDiscountAmount || null;

    await offer.save();
    return offer;
};

export const toggleOfferStatusService = async (id) => {
    const offer = await Offer.findById(id);
    if (!offer) throw new Error("Offer not found");

    if (!offer.isActive) {
        const overlapFilter = { 
            isActive: true, 
            type: offer.type,
            _id: { $ne: id },
            expiryDate: { $gt: new Date() }
        };
        if (offer.type === 'Product') {
            overlapFilter.productIds = { $in: offer.productIds };
        } else {
            overlapFilter.categoryIds = { $in: offer.categoryIds };
        }

        const existing = await Offer.findOne(overlapFilter);
        if (existing) {
            const target = offer.type === 'Product' ? "products" : "categories";
            throw new Error(`Conflict: Offer "${existing.name}" is already active for these ${target}`);
        }
    }

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
