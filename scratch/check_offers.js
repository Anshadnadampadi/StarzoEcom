import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function checkOffers() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");
        
        const Offer = mongoose.models.Offer || mongoose.model('Offer', new mongoose.Schema({}, { strict: false }));
        const offers = await Offer.find({});
        console.log("Offers count:", offers.length);
        console.log("Offers:", JSON.stringify(offers, null, 2));
        
        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
}

checkOffers();
