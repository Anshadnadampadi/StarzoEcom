import Product from "../../models/product/product.js";
import Category from "../../models/category/category.js";
import fs from "fs";
import path from "path";
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

    const [products, totalProducts, categories] = await Promise.all([
        Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('category', 'name'),
        Product.countDocuments(filter),
        Category.find({ isUnlisted: false }).select('name')
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    return {
        products,
        categories,
        currentPage: page,
        totalPages,
        totalProducts,
        searchQuery,
        sortBy,
        isBlockedFilter
    };
};

export const getAddProductData = async () => {
    return await Category.find({ isUnlisted: false }).select('name');
};

export const createProduct = async (productData) => {
    const { name, brand, category, price, stock } = productData;
    console.log(category)

    const newProduct = new Product({
        name,
        brand,
        category,
        price: parseFloat(price),
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
        const firstVariant = product.variants[0];
        product.price = firstVariant.price;
        product.stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    }
    return product;
};

export const addVariant = async (productId, variantData, files) => {
    const { color, ram, storage, price, stock } = variantData;
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    const images = files ? files.map(file => `/uploads/products/${file.filename}`) : [];
    if (images.length < 3) {
        if (files) {
            files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
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

    const variant = product.variants[index];
    if (files && files.length > 0) {
        const newImages = files.map(file => `/uploads/products/${file.filename}`);
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

    if (product.variants[index].images) {
        product.variants[index].images.forEach(img => {
            const imgPath = path.join(process.cwd(), img);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
    }

    product.variants.splice(index, 1);
    syncProductStats(product);
    return await product.save();
};

export const deleteVariantAsset = async (productId, index, imgIndex) => {
    const product = await Product.findById(productId);
    if (!product || !product.variants[index]) {
        throw new Error("Product or Variant not found");
    }

    const variant = product.variants[index];
    const imgPath = variant.images[imgIndex];
    if (imgPath) {
        const fullPath = path.join(process.cwd(), imgPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    variant.images.splice(imgIndex, 1);
    syncProductStats(product);
    return await product.save();
};

export const updateProduct = async (productId, updateData) => {
    const { name, brand, category, price, stock } = updateData;
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found");
    }

    const updatedData = {
        name,
        brand,
        category,
        price: parseFloat(price),
        stock: parseInt(stock)
    };

    const result = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
    commonCache.delete(CACHE_KEYS.PUBLIC_BRANDS);
    return result;
};


