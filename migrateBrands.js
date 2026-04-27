import mongoose from "mongoose";
import dotenv from "dotenv";
import Brand from "./models/product/Brand.js";
import Product from "./models/product/Product.js";

dotenv.config();

const migrateBrands = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB...");

        const products = await Product.find({});
        console.log(`Found ${products.length} products.`);

        for (const product of products) {
            if (typeof product.brand === 'string') {
                const brandName = product.brand.trim();
                if (!brandName) continue;

                let brand = await Brand.findOne({ name: { $regex: new RegExp(`^${brandName}$`, 'i') } });
                
                if (!brand) {
                    console.log(`Creating new brand: ${brandName}`);
                    brand = new Brand({ name: brandName });
                    await brand.save();
                }

                product.brand = brand._id;
                await product.save();
                console.log(`Updated product ${product.name} with brand ID ${brand._id}`);
            }
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrateBrands();
