import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function migrateOffers() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");
        
        const Offer = mongoose.models.Offer || mongoose.model('Offer', new mongoose.Schema({}, { strict: false }));
        const offers = await Offer.find({});
        console.log(`Found ${offers.length} offers to process.`);

        for (const offer of offers) {
            let updated = false;
            const updateData = {};

            // Migrate productId to productIds array
            if (offer.productId && (!offer.productIds || offer.productIds.length === 0)) {
                updateData.productIds = [offer.productId];
                updated = true;
                console.log(`Migrating productId for offer: ${offer.name}`);
            }

            // Migrate categoryId to categoryIds array
            if (offer.categoryId && (!offer.categoryIds || offer.categoryIds.length === 0)) {
                updateData.categoryIds = [offer.categoryId];
                updated = true;
                console.log(`Migrating categoryId for offer: ${offer.name}`);
            }

            if (updated) {
                await Offer.updateOne({ _id: offer._id }, { $set: updateData });
            }
        }

        console.log("Migration completed.");
        await mongoose.disconnect();
    } catch (err) {
        console.error("Migration failed:", err);
    }
}

migrateOffers();
