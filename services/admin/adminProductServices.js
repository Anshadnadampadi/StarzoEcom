import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";
import Brand from "../../models/product/Brand.js";

import { commonCache, CACHE_KEYS } from "../common/cacheService.js";

export const getProductManagementData = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const searchQuery = query.search || "";
    const sortBy = query.sortBy || "newest";
    const isBlockedFilter = "false";

    let filter = {};

    if (searchQuery) {
        filter.name = { $regex: searchQuery, $options: "i" };
    }

    // NEW FILTER
    if (isBlockedFilter === "true") {
        filter.isBlocked = true;
    } else if (isBlockedFilter === "false") {
        filter.isBlocked = false;
    }

    let sort = { createdAt: -1 };
    if (sortBy === "A-Z") sort = { name: 1 };
    else if (sortBy === "Z-A") sort = { name: -1 };
    else if (sortBy === "stock_low") sort = { stock: 1 };
    else if (sortBy === "stock_high") sort = { stock: -1 };

    const [products, totalProducts, categories, brands] = await Promise.all([
        Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('category', 'name'),
        Product.countDocuments(filter),
        Category.find({ isUnlisted: false }).select('name'),
        Product.distinct('brand')
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products,
        categories,
        brands,
        currentPage: page,
        totalPages,
        totalProducts,
        searchQuery,
        sortBy,
        isBlockedFilter
    };
};

export const getAddProductData = async () => {
    const categories = await Category.find({ isUnlisted: false }).select('name');
    const brands = await Product.distinct('brand');
    return { categories, brands };
};

export const checkDuplicateProductName = async (name, excludeId = null) => {
    const query = { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } };
    if (excludeId) query._id = { $ne: excludeId };
    const product = await Product.findOne(query);
    return !!product;
};

export const createProduct = async (productData) => {
    const { name, brand, category, stock } = productData;

    // Check for duplicate product name (case-insensitive)
    const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingProduct) {
        throw new Error("A product with this name already exists.");
    }

    const newProduct = new Product({
        name,
        brand,
        category,
        stock: parseInt(stock),
        isListed: true,
        isBlocked: false
    });

    const result = await newProduct.save();
    commonCache.delete(CACHE_KEYS.PUBLIC_BRANDS);
    return result;
};

export const toggleProductStatus = async (id) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new Error("Product not found");
    }

    product.isListed = !product.isListed;
    await product.save();
    commonCache.delete(CACHE_KEYS.PUBLIC_BRANDS);
    return product;
};

export const deleteProduct = async (id) => {
    const product = await Product.findById(id);
    if (!product) {
        throw new Error("Product not found");
    }

    product.isBlocked = !product.isBlocked;
    await product.save();
    commonCache.delete(CACHE_KEYS.PUBLIC_BRANDS);
    return product;
};

export const getProductById = async (id) => {
    const product = await Product.findById(id).populate('category');
    if (!product) {
        throw new Error("Product not found");
    }
    return product;
};
/**
 * Helper to sync product price/stock with its variants
 * price = price of the FIRST variant
 * stock = SUM of all variant stocks
 */
const syncProductStats = (product) => {
    if (product.variants && product.variants.length > 0) {
        // Only consider active (non-deleted) variants for stock/price calculations
        const activeVariants = product.variants.filter(v => !v.isDeleted);
        if (activeVariants.length > 0) {
            product.price = activeVariants[0].price;
            product.stock = activeVariants.reduce((sum, v) => sum + v.stock, 0);
        } else {
            // All variants deleted — zero out the product
            product.stock = 0;
        }
    }
    return product;
};

export const addVariant = async (productId, variantData, files) => {
    const { color, ram, storage, price, stock } = variantData;
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    // Check for duplicate variant within this product
    const isDuplicate = product.variants.some(v => 
        !v.isDeleted &&
        v.color.toLowerCase() === color.toLowerCase() &&
        v.ram.toLowerCase() === ram.toLowerCase() &&
        v.storage.toLowerCase() === storage.toLowerCase()
    );
    if (isDuplicate) {
        throw new Error("A variant with this specific combination (Color/RAM/Storage) already exists for this product.");
    }

    const images = files ? files.map(file => file.path) : [];
    if (images.length < 3) {
        throw new Error("At least 3 images are required for a variant.");
    }

    const newVariant = {
        color,
        ram,
        storage,
        price: parseFloat(price),
        stock: parseInt(stock),
        images
    };

    product.variants.push(newVariant);
    syncProductStats(product);
    return await product.save();
};

export const updateVariant = async (productId, index, variantData, files) => {
    const { color, ram, storage, price, stock } = variantData;
    const product = await Product.findById(productId);

    if (!product || !product.variants[index]) {
        throw new Error("Product or Variant not found");
    }

    // Check for duplicate variant within this product (excluding current variant)
    const isDuplicate = product.variants.some((v, idx) => 
        idx !== parseInt(index) &&
        !v.isDeleted &&
        v.color.toLowerCase() === color.toLowerCase() &&
        v.ram.toLowerCase() === ram.toLowerCase() &&
        v.storage.toLowerCase() === storage.toLowerCase()
    );
    if (isDuplicate) {
        throw new Error("Another variant with this specific combination (Color/RAM/Storage) already exists for this product.");
    }

    const variant = product.variants[index];

    // Prevent editing a soft-deleted variant
    if (variant.isDeleted) {
        throw new Error("Cannot edit a deleted variant. Please restore it first.");
    }

    if (files && files.length > 0) {
        const newImages = files.map(file => file.path);
        variant.images.push(...newImages);
    }

    variant.color = color;
    variant.ram = ram;
    variant.storage = storage;
    variant.price = parseFloat(price);
    variant.stock = parseInt(stock);

    syncProductStats(product);
    return await product.save();
};

export const deleteVariant = async (productId, index) => {
    const product = await Product.findById(productId);

    if (!product || !product.variants[index]) {
        throw new Error("Product or Variant not found");
    }

    const variant = product.variants[index];

    // prevent double delete
    if (variant.isDeleted) {
        throw new Error("Variant already unlisted");
    }

    // SOFT DELETE (unlist)
    variant.isDeleted = true;
    variant.deletedAt = new Date();

    syncProductStats(product);

    return await product.save();
};

export const restoreVariant = async (productId, index) => {
    const product = await Product.findById(productId);

    if (!product || !product.variants[index]) {
        throw new Error("Product or Variant not found");
    }

    const variant = product.variants[index];

    // Can only restore if currently deleted
    if (!variant.isDeleted) {
        throw new Error("Variant is already listed");
    }

    // RESTORE (re-list)
    variant.isDeleted = false;
    variant.deletedAt = null;

    syncProductStats(product);

    return await product.save();
};

export const deleteVariantAsset = async (productId, index, imgIndex) => {
    const product = await Product.findById(productId);

    if (!product || !product.variants[index]) {
        throw new Error("Product or Variant not found");
    }

    const variant = product.variants[index];

    if (!variant.images || !variant.images[imgIndex]) {
        throw new Error("Image not found");
    }

    // Remove the image from the array
    variant.images.splice(imgIndex, 1);

    syncProductStats(product);

    return await product.save();
};

export const updateProduct = async (productId, updateData) => {
    const { name, brand, category, stock } = updateData;
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    // Check for duplicate product name (case-insensitive, excluding current product)
    const existingProduct = await Product.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: productId }
    });
    if (existingProduct) {
        throw new Error("Another product with this name already exists.");
    }

    const updatedData = {
        name,
        brand,
        category,
        stock: parseInt(stock)
    };

    const result = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
    commonCache.delete(CACHE_KEYS.PUBLIC_BRANDS);
    return result;
};


