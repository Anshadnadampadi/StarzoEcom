import * as userProductService from "../../../services/user/userProductService.js";
import Wishlist from "../../../models/wishlist/wishlist.js";

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
            const wishlist = await Wishlist.findOne({ userId: req.session.user }).select("items.productId").lean();
            if (wishlist) {
                wishlistedIds = wishlist.items.map(item => item.productId.toString());
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
        const defaultVariant = product?.variants?.[0] || null;

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
        if (req.session.user) {
            const wishlist = await Wishlist.findOne({ 
                userId: req.session.user,
                "items.productId": req.params.id 
            });
            if (wishlist) isWishlisted = true;
        }

        const { msg, icon } = req.query;

        res.render("user/productDetails", {
            product,
            recommendedProducts,
            recentlyViewedProducts,
            isWishlisted,

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