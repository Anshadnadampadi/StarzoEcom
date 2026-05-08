import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/product/product.js';

dotenv.config();

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create a dummy product
        const testProduct = new Product({
            name: "Reservation Test Phone",
            brand: "TestBrand",
            category: new mongoose.Types.ObjectId(), // dummy
            variants: [
                {
                    color: "Red",
                    storage: "128GB",
                    ram: "8GB",
                    price: 50000,
                    stock: 10,
                    reservedStock: 0
                }
            ]
        });

        await testProduct.save();
        console.log("Initial Product Saved:", {
            totalStock: testProduct.stock,
            reservedStock: testProduct.reservedStock,
            variantStock: testProduct.variants[0].stock,
            variantReserved: testProduct.variants[0].reservedStock
        });

        // 2. Simulate reservation (User clicks checkout)
        testProduct.variants[0].reservedStock = 2;
        await testProduct.save();
        console.log("After Reservation (2 units):", {
            totalStock: testProduct.stock, // Should be 8
            reservedStock: testProduct.reservedStock, // Should be 2
            variantStock: testProduct.variants[0].stock, // Should be 10 (physical)
            variantReserved: testProduct.variants[0].reservedStock // Should be 2
        });

        // 3. Simulate Payment Success (Finalize sale)
        // We'll mimic the logic in finalizeStockSale
        testProduct.variants[0].stock -= 2;
        testProduct.variants[0].reservedStock = 0;
        await testProduct.save();
        console.log("After Success (Sale 2 units):", {
            totalStock: testProduct.stock, // Should be 8
            reservedStock: testProduct.reservedStock, // Should be 0
            variantStock: testProduct.variants[0].stock, // Should be 8 (physical)
            variantReserved: testProduct.variants[0].reservedStock // Should be 0
        });

        // 4. Simulate Reversion (Release reservation)
        testProduct.variants[0].reservedStock = 3;
        await testProduct.save();
        console.log("Re-reserved 3 units:", {
            totalStock: testProduct.stock, // Should be 5
            reservedStock: testProduct.reservedStock // Should be 3
        });

        testProduct.variants[0].reservedStock = 0;
        await testProduct.save();
        console.log("Released Reservation:", {
            totalStock: testProduct.stock, // Should be 8
            reservedStock: testProduct.reservedStock // Should be 0
        });

        // Cleanup
        await Product.findByIdAndDelete(testProduct._id);
        console.log("Test Product Deleted");

    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
