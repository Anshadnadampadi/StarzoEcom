import { validatePLPQuery } from "../../../utils/validateQuery.js";
import { getProductsService } from "../../../services/productService.js";
import Product from "../../../models/product/product.js";

export const loadProductListing = async (req, res) => {
    try {
        const products = await Product.find();

        res.render("user/product/productListPage", {
            products,
            query: req.query   // ✅ ADD THIS
        });

    } catch (error) {
        console.log(error);
        res.redirect("/pageNotFound");
    }
};