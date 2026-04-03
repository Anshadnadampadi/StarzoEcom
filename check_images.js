import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const Product = (await import('./models/product/product.js')).default;
    const latestProduct = await Product.findOne().sort({ createdAt: -1 });
    console.log("Latest Product:", latestProduct.name);
    console.log("Product Images:", latestProduct.images);
    console.log("Variant Images:", latestProduct.variants.map(v => v.images));
    process.exit(0);
});
