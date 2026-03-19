import express from "express";
import { adminAuth } from "../../../middlewares/adminAuth.js";
import { 
    getCategories, 
    getCategoryById,
    addCategory, 
    updateCategory, 
    toggleCategoryStatus
} from "../../../controllers/admin/category/categoryController.js";

const router = express.Router();

// 1. Page Load Route
router.get("/categories", adminAuth, getCategories);

// 2. API Route to get data for the Edit Modal
router.get("/categories/api/:id", adminAuth, getCategoryById);

// 3. Action Routes
router.post("/categories/add", adminAuth, addCategory);           // Create
router.put("/categories/edit/:id", adminAuth, updateCategory);    // Update
router.patch("/categories/delete/:id", adminAuth, toggleCategoryStatus);// Toggle Visibility


export default router;