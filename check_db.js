import mongoose from 'mongoose';
import Product from './models/product/product.js';
import Category from './models/category/category.js';
import dotenv from 'dotenv/config';

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const products = await Product.find().limit(10).lean();
    console.log('--- PRODUCTS ---');
    products.forEach(p => {
        console.log(`Name: ${p.name}, Category: ${p.category}, Brand: ${p.brand}`);
    });
    const categories = await Category.find().lean();
    console.log('--- CATEGORIES ---');
    categories.forEach(c => {
        console.log(`Name: ${c.name}, ID: ${c._id}`);
    });
    await mongoose.connection.close();
}

check().catch(err => { console.error(err); process.exit(1); });
