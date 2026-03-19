import express from "express"
import { getProductManagement } from "../../../controllers/admin/adminControlller.js"
import { adminAuth } from "../../../middlewares/adminAuth.js"

const router = express.Router()

// Admin product management page
router.get("/productManagement", adminAuth, getProductManagement)

export default router
