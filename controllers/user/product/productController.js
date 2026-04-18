import * as userProductService from "../../../services/user/userProductService.js";
import Wishlist from "../../../models/wishlist/wishlist.js";
import { normalize } from "../../../utils/productHelpers.js";

export const loadProductListing = async (req, res) => {
    console.log("ok")
    try {
        const { search, category, brand, sort, price, page } = req.query;

        const data = await userProductService.getProductListing({
            searchQuery: search,
            categoryFilter: category,
            brandFilter: brand,
            sortFilter: sort || "newest",
            priceFilter: price,
            page: parseInt(page) || 1
        });

        // ── Wishlist State ──
        let wishlistedIds = [];
        if (req.session.user) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user }).select("items").lean();
            if (wishlist) {
                // Return keys in format: productId_color_storage_ram (normalized using productHelpers)
                wishlistedIds = wishlist.items.map(item => {
                    const v = item.variant || {};
                    return `${item.productId}_${normalize(v.color)}_${normalize(v.storage)}_${normalize(v.ram)}`;
                });
            }
        }

        if (req.xhr || req.headers.accept === "application/json") {
            return res.json({
                products: data.products,
                pagination: data.pagination,
                currentCount: data.total,
                wishlistedIds // Send this to the AJAX caller
            });
        }

        const { msg, icon } = req.query;
        res.render("user/products", {
            products: data.products,
            categories: data.categories,
            brands: data.brands,
            searchQuery: search || "",
            selectedCategories: category
                ? Array.isArray(category)
                    ? category
                    : [category]
                : [],
            selectedBrand: brand ? brand.split(',') : [],
            selectedSort: sort || "newest",
            selectedPrice: price || null,
            title: "Browse All Phones",
            wishlistedIds,
            breadcrumbs: [
                { label: 'Shop', url: '/products' }
            ],
            msg: msg || null,
            icon: icon || null
        });

    } catch (error) {
        console.error("Load Product Listing Error:", error);
        res.status(500).send("Server Error");
    }
};

export const getProductDetailsPage = async (req, res) => {
    try {
        const { product, recommendedProducts } =
            await userProductService.getProductDetails(req.params.id);

        // ✅ ADD THIS (IMPORTANT)
        // Pick first active variant as default
        const defaultVariant = product?.variants?.find(v => !v.isDeleted) || null;

        const defaultImage =
            defaultVariant?.images?.[0] || "/images/placeholder.jpg";

        const initialImages =
            defaultVariant?.images || [];

        // ── Recently Viewed tracking via session ──
        if (!req.session.recentlyViewed) {
            req.session.recentlyViewed = [];
        }

        const recentlyViewedProducts = await userProductService.getRecentlyViewedProducts(
            req.session.recentlyViewed,
            req.params.id
        );

        const currentId = req.params.id.toString();
        req.session.recentlyViewed = [
            currentId,
            ...req.session.recentlyViewed.filter(id => id !== currentId)
        ].slice(0, 10);

        // ── Wishlist state ──
        let isWishlisted = false;
        let wishlistedIds = [];
        if (req.session.user) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user }).lean();
            if (wishlist && wishlist.items) {
                wishlistedIds = wishlist.items.map(item => {
                    const v = item.variant || {};
                    return `${item.productId}_${normalize(v.color)}_${normalize(v.storage)}_${normalize(v.ram)}`;
                });

                // Check if the current default variant is in the list
                isWishlisted = wishlist.items.some(item => 
                    item.productId.toString() === req.params.id &&
                    normalize(item.variant?.color) === normalize(defaultVariant?.color) &&
                    normalize(item.variant?.storage) === normalize(defaultVariant?.storage) &&
                    normalize(item.variant?.ram) === normalize(defaultVariant?.ram)
                );
            }
        }

        const { msg, icon } = req.query;

        res.render("user/productDetails", {
            product,
            recommendedProducts,
            recentlyViewedProducts,
            isWishlisted,
            wishlistedIds,

            // NEW DATA 
            defaultVariant,
            defaultImage,
            initialImages,

            title: product.name,
            breadcrumbs: [
                { label: 'Shop', url: '/products' },
                { label: product.category?.name || 'Category', url: `/products?category=${product.category?._id || ''}` },
                { label: product.name, url: `/products/${product._id}` }
            ],
            msg: msg || null,
            icon: icon || null
        });

    } catch (error) {
        console.error("Get Product Details Error:", error);
        res.redirect("/products?msg=" + encodeURIComponent(error.message) + "&icon=error");
    }
};