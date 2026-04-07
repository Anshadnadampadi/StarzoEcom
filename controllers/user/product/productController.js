import * as userProductService from "../../../services/user/userProductService.js";

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

        if (req.xhr || req.headers.accept === "application/json") {
            return res.json({
                products: data.products,
                pagination: data.pagination,
                currentCount: data.total
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

        // Fetch recently viewed products BEFORE adding the current one
        const recentlyViewedProducts = await userProductService.getRecentlyViewedProducts(
            req.session.recentlyViewed,
            req.params.id
        );

        // Add current product to the front of the list
        const currentId = req.params.id.toString();
        req.session.recentlyViewed = [
            currentId,
            ...req.session.recentlyViewed.filter(id => id !== currentId)
        ].slice(0, 10); // Keep only last 10

        const { msg, icon } = req.query;

        res.render("user/productDetails", {
            product,
            recommendedProducts,
            recentlyViewedProducts,

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