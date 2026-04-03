import mongoose from "mongoose";

import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";
import { commonCache, CACHE_KEYS } from "../common/cacheService.js";

/**
 * Service to handle user-side product operations
 */
export const getProductListing = async ({ searchQuery, categoryFilter, brandFilter, sortFilter, priceFilter, page = 1, limit = 6 }) => {
    let filter = {
        isListed: true,
        isBlocked: false
    };

    if (searchQuery) {
        filter.name = { $regex: searchQuery, $options: "i" };
    }


    if (
        categoryFilter &&
        categoryFilter.trim() !== '' &&
        categoryFilter !== 'undefined' &&
        categoryFilter !== 'all'
    ) {
        filter.category = new mongoose.Types.ObjectId(categoryFilter);
    }

    if (brandFilter) {
        const brands = brandFilter.split(',').filter(b => b.trim() !== '');
        if (brands.length > 0) {
            filter.brand = { $in: brands };
        }
    }

    if (priceFilter) {
        const [min, max] = priceFilter.split('-');
        if (min && max) {
            filter.price = { $gte: Number(min), $lte: Number(max) };
        } else if (min) {
            filter.price = { $gte: Number(min) };
        } else if (max) {
            filter.price = { $lte: Number(max) };
        }
    }

    const skip = (page - 1) * limit;

    let sortOption = { createdAt: -1 };
    switch (sortFilter) {
        case "priceLow":
            sortOption = { price: 1 };
            break;
        case "priceHigh":
            sortOption = { price: -1 };
            break;
        case "aToZ":
            sortOption = { name: 1 };
            break;
        case "zToA":
            sortOption = { name: -1 };
            break;
        case "newest":
        default:
            sortOption = { createdAt: -1 };
            break;
    }

    // Try to get categories and brands from cache
    let categories = commonCache.get(CACHE_KEYS.CATEGORIES);
    let brands = commonCache.get(CACHE_KEYS.PUBLIC_BRANDS);

    const productsPromise = Product.find(filter)
        .sort(sortOption)
        .collation({ locale: 'en', strength: 2 })
        .skip(skip)
        .limit(limit)
        .lean();
    const countPromise = Product.countDocuments(filter);

    const promises = [productsPromise, countPromise];
    if (!categories) promises.push(Category.find({ isUnlisted: false }).lean());
    if (!brands) promises.push(Product.distinct("brand", { isListed: true, isBlocked: false }));

    const results = await Promise.all(promises);
    const products = results[0];
    const total = results[1];

    let resultIdx = 2;
    if (!categories) {
        categories = results[resultIdx++];
        commonCache.set(CACHE_KEYS.CATEGORIES, categories);
    }
    if (!brands) {
        brands = results[resultIdx++];
        commonCache.set(CACHE_KEYS.PUBLIC_BRANDS, brands);
    }

    const totalPages = Math.ceil(total / limit);

    let pagination = "";
    for (let i = 1; i <= totalPages; i++) {
        pagination += `<button class="pagination-link" data-page="${i}">${i}</button>`;
    }

    console.log(products)

    return {
        products,
        total,
        totalPages,
        categories,
        brands,
        pagination
    };
};

export const getProductDetails = async (id) => {
    const product = await Product.findById(id).populate('category');

    if (!product || product.isBlocked || !product.isListed) {
        throw new Error("Product unavailable");
    }

    const recommendedProducts = await Product.find({
        category: product.category?._id || product.category,
        _id: { $ne: product._id },
        isListed: true,
        isBlocked: false
    }).populate('category').limit(4).lean();

    return {
        product,
        recommendedProducts
    };
};

export const getRecentlyViewedProducts = async (productIds, excludeId) => {
    if (!productIds || productIds.length === 0) return [];

    // Filter out the current product and keep only unique IDs
    const filteredIds = productIds
        .filter(id => id && id.toString() !== excludeId?.toString());

    if (filteredIds.length === 0) return [];

    const products = await Product.find({
        _id: { $in: filteredIds },
        isListed: true,
        isBlocked: false
    }).populate('category').limit(4).lean();

    // Sort products in the same order as the IDs (most recent first)
    const idOrder = filteredIds.map(id => id.toString());
    products.sort((a, b) => idOrder.indexOf(a._id.toString()) - idOrder.indexOf(b._id.toString()));

    return products;
};
