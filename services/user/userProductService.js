import mongoose from "mongoose";

import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";
import Brand from "../../models/product/Brand.js";
import { commonCache, CACHE_KEYS } from "../common/cacheService.js";
import * as offerService from "../common/offerService.js";
import { applyReviewsToProducts } from "./reviewService.js";

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


        // Get active categories to ensure we only show products from listed categories
        const activeCategoriesList = await Category.find({ isUnlisted: false }).select('_id').lean();
        const activeCategoryIds = activeCategoriesList.map(cat => cat._id.toString());

        if (categoryFilter && categoryFilter !== 'undefined' && categoryFilter !== 'all') {
            let categoriesToFilter = categoryFilter;

            // convert to array if it's a string
            if (typeof categoriesToFilter === "string") {
                categoriesToFilter = [categoriesToFilter];
            }

            // Intersection: only keep requested categories that are also active
            const validRequestedCategories = categoriesToFilter.filter(id => activeCategoryIds.includes(id.toString()));
            filter.category = { $in: validRequestedCategories.map(id => new mongoose.Types.ObjectId(id)) };
        } else {
            // No specific filter, so just show from ALL active categories
            filter.category = { $in: activeCategoryIds.map(id => new mongoose.Types.ObjectId(id)) };
        }

        if (brandFilter) {
            const brandsToFilter = brandFilter.split(',').filter(b => b.trim() !== '');
            if (brandsToFilter.length > 0) {
                filter.brand = { $in: brandsToFilter };
            }
        }

        // Remove DB-level price filter and sorting since we need to apply offers first
        // to filter and sort by the effective price (discounted price)

        const skip = (page - 1) * limit;

        // Try to get categories and brands from cache
        let categories = commonCache.get(CACHE_KEYS.CATEGORIES);
        let brands = commonCache.get(CACHE_KEYS.PUBLIC_BRANDS);

        // Fetch all matching products without pagination/sorting to apply offers in-memory
        const productsPromise = Product.find(filter)
            .collation({ locale: 'en', strength: 2 })
            .lean();
        const promises = [productsPromise];
        if (!categories || categories.length === 0) promises.push(Category.find({ isUnlisted: false }).lean());
        if (!brands || brands.length === 0) promises.push(Product.distinct("brand", { isListed: true, isBlocked: false }));

        const results = await Promise.all(promises);
        const products = results[0];

        let resultIdx = 1;
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

        // 1. Apply Offers to get discountedPrice
        let productsWithOffers = await offerService.applyOffersToProducts(activeProducts);

        // 2. Apply Price Range Filter (using discountedPrice)
        if (priceFilter) {
            const [min, max] = priceFilter.split('-');
            productsWithOffers = productsWithOffers.filter(p => {
                const price = p.discountedPrice;
                if (min && max) return price >= Number(min) && price <= Number(max);
                if (min) return price >= Number(min);
                if (max) return price <= Number(max);
                return true;
            });
        }

        // 3. Apply Sorting (using discountedPrice or other fields)
        switch (sortFilter) {
            case "priceLow":
                productsWithOffers.sort((a, b) => a.discountedPrice - b.discountedPrice);
                break;
            case "priceHigh":
                productsWithOffers.sort((a, b) => b.discountedPrice - a.discountedPrice);
                break;
            case "aToZ":
                productsWithOffers.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "zToA":
                productsWithOffers.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case "newest":
            default:
                productsWithOffers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
        }

        const totalFiltered = productsWithOffers.length;
        const totalPages = Math.ceil(totalFiltered / limit);

        // 4. Manual Pagination (Slice)
        const paginatedProducts = productsWithOffers.slice(skip, skip + limit);

        // 5. Apply Reviews only to the paginated result (Optimization)
        const productsWithReviews = await applyReviewsToProducts(paginatedProducts);

        let pagination = "";
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === page ? "active" : "";
            pagination += `<a href="#" class="page-link ${activeClass}" data-page="${i}" onclick="event.preventDefault(); loadProducts(${i})">${i}</a>`;
        }

        return {
            products: productsWithReviews,
            total: totalFiltered,
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

    if (!product || product.isBlocked || !product.isListed || (product.category && product.category.isUnlisted)) {
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

    // Get active categories to ensure we only show products from listed categories
    const activeCategoriesList = await Category.find({ isUnlisted: false }).select('_id').lean();
    const activeCategoryIds = activeCategoriesList.map(cat => cat._id);

    const products = await Product.find({
        _id: { $in: filteredIds },
        isListed: true,
        isBlocked: false,
        category: { $in: activeCategoryIds }
    }).populate('category').limit(4).lean();

    // Sort products in the same order as the IDs (most recent first)
    const idOrder = filteredIds.map(id => id.toString());
    products.sort((a, b) => idOrder.indexOf(a._id.toString()) - idOrder.indexOf(b._id.toString()));

    // Apply offers
    const productsWithOffers = await offerService.applyOffersToProducts(products);

    return productsWithOffers;
};
