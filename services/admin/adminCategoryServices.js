import Category from "../../models/category/category.js";
import Product from "../../models/product/product.js";

import { commonCache, CACHE_KEYS } from "../common/cacheService.js";

export const getCategoryManagementData = async (query) => {
    const page = parseInt(query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const searchQuery = query.search || "";

    const filter = searchQuery 
        ? { 
            $or: [
                { name: { $regex: searchQuery, $options: "i" } },
                { slug: { $regex: searchQuery, $options: "i" } }
            ]
          } 
        : {};

    const [categories, totalCategories] = await Promise.all([
        Category.find(filter)
            .sort({ displayOrder: 1 })
            .skip(skip)
            .limit(limit),
        Category.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCategories / limit);

    return {
        categories,
        currentPage: page,
        totalPages,
        totalCategories,
        searchQuery
    };
};

export const getCategoryById = async (id) => {
    const category = await Category.findById(id);
    if (!category) {
        throw new Error("Category not found");
    }
    return category;
};

export const createCategory = async (categoryData, file) => {
    const { name, slug, displayOrder, metaDescription } = categoryData;
    const icon = file ? file.path : '📁';

    const newCategory = new Category({
        name, 
        slug, 
        icon, 
        displayOrder, 
        metaDescription 
    });
    const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingCategory) {
        throw new Error("Category with this name already exists");
    }

    const existingSlug = await Category.findOne({ slug });
    if (existingSlug) {
        throw new Error("This URL Path (slug) is already in use");
    }

    const result = await newCategory.save();
    commonCache.delete(CACHE_KEYS.CATEGORIES);
    return result;
};

export const updateCategory = async (id, categoryData, file) => {
    const category = await Category.findById(id);
    if (!category) {
        throw new Error("Category not found");
    }

    const updateData = { ...categoryData };

    if (updateData.name) {
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            throw new Error("Category with this name already exists");
        }
    }

    if (updateData.slug) {
        const existingSlug = await Category.findOne({
            slug: updateData.slug,
            _id: { $ne: id }
        });

        if (existingSlug) {
            throw new Error("This URL Path (slug) is already in use");
        }
    }

    if (file) {
        updateData.icon = file.path;
    }

    const result = await Category.findByIdAndUpdate(id, updateData, { new: true });
    commonCache.delete(CACHE_KEYS.CATEGORIES);
    return result;
};

export const toggleCategoryStatus = async (id) => {
    const category = await Category.findById(id);
    if (!category) {
        throw new Error("Category not found");
    }

    category.isUnlisted = !category.isUnlisted;
    const result = await category.save();
    commonCache.delete(CACHE_KEYS.CATEGORIES);
    return result;
};

export const deleteCategory = async (id) => {
    const category = await Category.findById(id);
    if (!category) {
        throw new Error("Category not found");
    }

    // Check if any products are associated with this category
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
        throw new Error(`Cannot delete category: ${productCount} products are still linked to it.`);
    }

    const result = await Category.findByIdAndDelete(id);
    commonCache.delete(CACHE_KEYS.CATEGORIES);
    return result;
};
