import express from "express";
import {
    getProductManagement,
    getAddProduct,
    addProduct,
    toggleProductStatus,
    deleteProduct,
    getProductDetails,
    updateProduct,
    getAddVariant,
    postAddVariant,
    getProductJson,
    getEditVariant,
    updateVariant,
    deleteVariant,
    deleteVariantAsset
} from "../../controllers/admin/product/adminProductController.js";
import { uploadProductImage } from "../../middlewares/uploadMiddleware.js";
import { loadProductListing, getProductDetailsPage } from "../../controllers/user/product/productController.js";
import { productValidation, handleValidationErrors } from "../../middlewares/admin/validation.js";


const router = express.Router();

router.get("/productManagement", getProductManagement);
router.get("/products/add", getAddProduct);
router.post("/products/add", uploadProductImage.array('images', 5), productValidation, handleValidationErrors, addProduct);
router.patch("/products/toggle-status/:id", toggleProductStatus);
router.delete("/products/delete/:id", deleteProduct);
router.get("/products/details/:id", getProductDetails);
router.get("/products/add-variant/:id", getAddVariant);
router.post("/products/add-variant/:id", uploadProductImage.array('images', 5), postAddVariant);
router.patch("/products/update/:id", uploadProductImage.array('images', 5), productValidation, handleValidationErrors, updateProduct);

router.get("/products/json/:id", getProductJson);
router.get("/products/variant/edit/:id/:index", getEditVariant);
router.patch("/products/variant/update/:id/:index", uploadProductImage.array('images', 5), updateVariant);
router.delete("/products/variant/delete/:id/:index", deleteVariant);
router.delete("/products/variant/delete-asset/:id/:index/:imgIndex", deleteVariantAsset);

router.get("/products", loadProductListing);
router.get("/products/:id", getProductDetailsPage)


export default router;