import mongoose from "mongoose";

import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";
import Brand from "../../models/product/Brand.js";
import { commonCache, CACHE_KEYS } from "../common/cacheService.js";
import * as offerService from "../common/offerService.js";

/**
 * Service to handle user-side product operations
 */
export const getProductListing = async ({ searchQuery, categoryFilter, brandFilter, sortFilter, priceFilter, page = 1, limit = 6 }) => {
    try {
        let filter = {
            isListed: true,
            isBlocked: false
        };

        if (searchQuery) {
            filter.name = { $regex: searchQuery, $options: "i" };
        }


        if (categoryFilter && categoryFilter !== 'undefined' && categoryFilter !== 'all') {
            let categoriesToFilter = categoryFilter;

            // convert to array if it's a string
            if (typeof categoriesToFilter === "string") {
                categoriesToFilter = [categoriesToFilter];
            }

            // convert all to ObjectId
            categoriesToFilter = categoriesToFilter.map(id => new mongoose.Types.ObjectId(id));

            filter.category = { $in: categoriesToFilter }; //  supports multiple
        }

        if (brandFilter) {
            const brandsToFilter = brandFilter.split(',').filter(b => b.trim() !== '');
            if (brandsToFilter.length > 0) {
                filter.brand = { $in: brandsToFilter };
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
        if (!categories || categories.length === 0) promises.push(Category.find({ isUnlisted: false }).lean());
        if (!brands || brands.length === 0) promises.push(Product.distinct("brand", { isListed: true, isBlocked: false }));

        const results = await Promise.all(promises);
        const products = results[0];
        const total = results[1];

        console.log(`[DEBUG] Products found in DB: ${products.length}, Limit: ${limit}, Total: ${total}`);

        let resultIdx = 2;
        if (promises.length > 2) {
            if (!categories || categories.length === 0) {
                categories = results[resultIdx++];
                commonCache.set(CACHE_KEYS.CATEGORIES, categories);
            }
            if (!brands || brands.length === 0) {
                brands = results[resultIdx++];
                commonCache.set(CACHE_KEYS.PUBLIC_BRANDS, brands);
            }
        }

        // Filter out products where ALL variants are soft-deleted (no purchasable options left)
        const activeProducts = products.filter(product => {
            if (!product.variants || product.variants.length === 0) return true;
            return product.variants.some(v => !v.isDeleted);
        });

        const productsWithOffers = await offerService.applyOffersToProducts(activeProducts);

        const totalPages = Math.ceil(total / limit);

        let pagination = "";
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === page ? "active" : "";
            pagination += `<a href="#" class="page-link ${activeClass}" data-page="${i}" onclick="event.preventDefault(); loadProducts(${i})">${i}</a>`;
        }

        return {
            products: productsWithOffers,
            total,
            totalPages,
            currentPage: page,
            categories,
            brands,
            pagination
        };
    } catch (error) {
        console.error(`[ERROR] getProductListing Failed:`, {
            message: error.message,
            stack: error.stack,
            filters: { searchQuery, categoryFilter, brandFilter, sortFilter, priceFilter, page }
        });
        throw error;
    }
};

export const getProductDetails = async (id) => {
    const product = await Product.findById(id).populate('category');

    if (!product || product.isBlocked || !product.isListed) {
        throw new Error("Product unavailable");
    }

    // If product has variants but all are soft-deleted, treat it as unavailable
    if (product.variants?.length > 0) {
        const hasActiveVariant = product.variants.some(v => !v.isDeleted);
        if (!hasActiveVariant) {
            throw new Error("Product unavailable");
        }
    }

    const recommendedProducts = await Product.find({
        category: product.category?._id || product.category,
        _id: { $ne: product._id },
        isListed: true,
        isBlocked: false
    }).populate('category').limit(4).lean();

    // Filter recommended: also exclude products with all-deleted variants
    const activeRecommended = recommendedProducts.filter(p => {
        if (!p.variants || p.variants.length === 0) return true;
        return p.variants.some(v => !v.isDeleted);
    });

    // Apply offers to details and recommended
    const { discountedPrice, bestOffer } = await offerService.getBestOfferForProduct(product);
    const recommendedWithOffers = await offerService.applyOffersToProducts(activeRecommended);

    return {
        product: {
            ...product.toObject(),
            discountedPrice,
            bestOffer,
            hasOffer: discountedPrice < product.price
        },
        recommendedProducts: recommendedWithOffers
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

    // Apply offers
    const productsWithOffers = await offerService.applyOffersToProducts(products);

    return productsWithOffers;
};
