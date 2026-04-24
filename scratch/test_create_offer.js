import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Offer from '../models/offer/offer.js';

const MONGO_URI = process.env.MONGO_URI;

async function testCreateOffer() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");
        
        const data = {
            name: "Test Offer " + Date.now(),
            type: "Product",
            discountType: "percentage",
            discountValue: 10,
            productId: new mongoose.Types.ObjectId(), // Just a random ID for testing
            expiryDate: new Date(Date.now() + 86400000)
        };
        
        console.log("Creating offer with data:", data);
        const offer = await Offer.create(data);
        console.log("Offer created successfully:", offer._id);
        
        await mongoose.disconnect();
    } catch (err) {
        console.error("Error creating offer:", err);
        await mongoose.disconnect();
    }
}

testCreateOffer();
