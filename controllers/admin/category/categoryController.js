import * as adminCategoryServices from "../../../services/admin/adminCategoryServices.js";
import { categoryValidate } from "../../../validation/admin/adminValidation.js";

export const getCategories = async (req, res) => {
    try {
        const data = await adminCategoryServices.getCategoryManagementData(req.query);
        const { msg, icon } = req.query;
        res.render('admin/categoryManagement', { 
            ...data,
            breadcrumbs: [
                { label: 'Categories', url: '/admin/categories' }
            ],
            msg: msg || null,
            icon: icon || null
        });
    } catch (error) {
        console.error("Search/Pagination Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

export const getCategoryById = async (req, res) => {
    try {
        const category = await adminCategoryServices.getCategoryById(req.params.id);
        res.json(category);
    } catch (error) {
        res.status(404).json({ message: error.message || "Category not found" });
    }
};

export const addCategory = async (req, res) => {
    try {
        const { error, value } = categoryValidate.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        await adminCategoryServices.createCategory(value, req.file);
        return res.status(201).json({ 
            success: true, 
            message: "Category created successfully!" 
        });
    } catch (error) {
        console.error("Backend Error:", error);
        
        // Cloudinary cleanup could be implemented here if needed


        let message = "Error adding category";
        if (error.code === 11000) {
            if (error.message.includes('name')) {
                message = "Category with this name already exists.";
            } else if (error.message.includes('slug')) {
                message = "This URL Slug already exists. Please use a unique one.";
            } else {
                message = "Duplicate entry found. Please ensure name and slug are unique.";
            }
        }

        return res.status(400).json({ 
            success: false, 
            message: error.message || message 
        });
    }
};

export const updateCategory = async (req, res) => {
    try {
        const { error, value } = categoryValidate.validate({ ...req.body, id: req.params.id });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message 
            });
        }

        await adminCategoryServices.updateCategory(req.params.id, value, req.file);
        res.json({ success: true, message: "Category updated successfully!" });
    } catch (error) {
        console.error("Update Error:", error);
        // Cloudinary cleanup could be implemented here if needed

        res.status(500).json({ success: false, message: error.message || "Error updating category" });
    }
};

export const toggleCategoryStatus = async (req, res) => {
    try {
        await adminCategoryServices.toggleCategoryStatus(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        await adminCategoryServices.deleteCategory(req.params.id);
        res.json({ success: true, message: "Category deleted successfully!" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "Error deleting category" 
        });
    }
};

