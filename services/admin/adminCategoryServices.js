import Category from "../../models/category/category.js";
import fs from "fs";
import path from "path";
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
    const icon = file ? `/uploads/categories/${file.filename}` : '📁';

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

    if (file) {
        if (category.icon && category.icon.startsWith('/uploads/')) {
            const oldPath = path.join(process.cwd(), category.icon);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        updateData.icon = `/uploads/categories/${file.filename}`;
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
