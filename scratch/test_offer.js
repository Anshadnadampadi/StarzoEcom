import mongoose from 'mongoose';
import Offer from '../models/offer/offer.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const data = {
            name: "Test Offer",
            type: "Product",
            discountType: "percentage",
            discountValue: 10,
            productId: "64e0a1b2c3d4e5f6a7b8c9d0", // Mock ID
            categoryId: null,
            expiryDate: new Date(Date.now() + 86400000)
        };

        const offer = await Offer.create(data);
        console.log("Offer created successfully:", offer._id);
        await Offer.findByIdAndDelete(offer._id);
        console.log("Test offer deleted");
        
    } catch (err) {
        console.error("Error creating offer:", err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
