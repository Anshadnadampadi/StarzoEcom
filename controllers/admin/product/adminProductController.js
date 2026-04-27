import * as adminProductServices from "../../../services/admin/adminProductServices.js";

export const getProductManagement = async (req, res) => {
    try {
        const data = await adminProductServices.getProductManagementData(req.query);
        const { msg, icon } = req.query;
        res.render("admin/productManagement", {
            title: 'Product Management',
            ...data,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Products', url: '/admin/productManagement' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Product Management Error:", error);
        res.redirect("/admin/dashboard?msg=Error loading product management&icon=error");
    }
};

export const getAddProduct = async (req, res) => {
    const { categories, brands } = await adminProductServices.getAddProductData();
    try {
        const { msg, icon } = req.query;
        res.render("admin/addProduct", {
            title: 'Add Product',
            categories,
            brands,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Products', url: '/admin/productManagement' },
                { label: 'Add Product', url: '/admin/products/add' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Get Add Product Error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const addProduct = async (req, res) => {
    try {
        await adminProductServices.createProduct(req.body, req.files);
        res.status(201).json({ 
            success: true, 
            message: "Product created successfully!" 
        });
    } catch (error) {
        console.error("Add Product Error:", error);
        
        // Cloudinary handles storage; error cleanup could be added here if needed


        res.status(500).json({ 
            success: false, 
            message: error.message || "Error adding product" 
        });
    }
};

export const toggleProductStatus = async (req, res) => {
    try {
        const product = await adminProductServices.toggleProductStatus(req.params.id);
        res.json({ 
            success: true, 
            message: `Product ${product.isListed ? 'listed' : 'unlisted'} successfully`,
            isListed: product.isListed
        });
    } catch (error) {
        console.error("Toggle Status Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const product = await adminProductServices.deleteProduct(req.params.id);
        res.json({ 
            success: true, 
            message: `Product ${product.isBlocked ? 'soft-deleted' : 'restored'} successfully` 
        });
    } catch (error) {
        console.error("Delete Product Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const getProductDetails = async (req, res) => {
    try {
        const product = await adminProductServices.getProductById(req.params.id);
        const { msg, icon } = req.query;
        res.render("admin/productDetails", {
            title: 'Product Details',
            product,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Products', url: '/admin/productManagement' },
                { label: product.name, url: `/admin/products/details/${product._id}` }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Get Product Details Error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const getAddVariant = async (req, res) => {
    try {
        const product = await adminProductServices.getProductById(req.params.id);
        const { msg, icon } = req.query;
        res.render("admin/addVariant", {
            title: 'Add Variant',
            product,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Products', url: '/admin/productManagement' },
                { label: product.name, url: `/admin/productDetails/${product._id}` },
                { label: 'Add Variant', url: `/admin/products/add-variant/${product._id}` }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Get Add Variant Error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const postAddVariant = async (req, res) => {
    try {
        await adminProductServices.addVariant(req.params.id, req.body, req.files);
        res.status(201).json({ 
            success: true, 
            message: "Variant added successfully!" 
        });
    } catch (error) {
        console.error("Add Variant Error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || "Error adding variant" 
        });
    }
};

export const getEditVariant = async (req, res) => {
    try {
        const product = await adminProductServices.getProductById(req.params.id);
        const index = req.params.index;
        const variant = product.variants[index];
        
        if (!variant) {
            return res.redirect("/admin/productManagement");
        }
        
        const { msg, icon } = req.query;
        res.render("admin/editVariant", {
            title: 'Edit Variant',
            product,
            variant,
            variantIndex: index,
            breadcrumbs: [
                { label: 'Admin', url: '/admin/dashboard' },
                { label: 'Products', url: '/admin/productManagement' },
                { label: product.name, url: `/admin/productDetails/${product._id}` },
                { label: `Edit Variant (${variant.color})`, url: `/admin/products/variant/edit/${product._id}/${index}` }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Get Edit Variant Error:", error);
        res.redirect("/admin/productManagement");
    }
};

export const updateVariant = async (req, res) => {
    try {
        await adminProductServices.updateVariant(req.params.id, req.params.index, req.body, req.files);
        res.json({ success: true, message: "Variant updated successfully!" });
    } catch (error) {
        console.error("Update Variant Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const deleteVariant = async (req, res) => {
    try {
        await adminProductServices.deleteVariant(req.params.id, req.params.index);
        res.json({ success: true, message: "Variant unlisted successfully" });
    } catch (error) {
        console.error("Delete Variant Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const restoreVariant = async (req, res) => {
    try {
        await adminProductServices.restoreVariant(req.params.id, req.params.index);
        res.json({ success: true, message: "Variant listed successfully" });
    } catch (error) {
        console.error("Restore Variant Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const deleteVariantAsset = async (req, res) => {
    try {
        await adminProductServices.deleteVariantAsset(req.params.id, req.params.index, req.params.imgIndex);
        res.json({ success: true, message: "Asset deleted successfully" });
    } catch (error) {
        console.error("Delete Variant Asset Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const getProductJson = async (req, res) => {
    try {
        const product = await adminProductServices.getProductById(req.params.id);
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};

export const updateProduct = async (req, res) => {
    try {
        await adminProductServices.updateProduct(req.params.id, req.body, req.files);
        res.json({ success: true, message: "Product updated successfully!" });
    } catch (error) {
        console.error("Update Product Error:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
};
