import express from "express"
import { loadProductListing } from "../../../controllers/user/product/productController.js"

const router = express.Router()

// User - Product listing page
router.get("/products", loadProductListing)

export default router