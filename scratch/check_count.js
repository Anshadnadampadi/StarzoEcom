
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/product/product.js';

dotenv.config();

async function checkProductCount() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Product.countDocuments();
        console.log(`Total products: ${count}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkProductCount();
