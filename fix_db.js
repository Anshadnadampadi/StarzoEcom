import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/StarzoMobiles')
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      const products = await db.collection('products').find({}).toArray();
      let updatedCount = 0;
      for (const p of products) {
        if (typeof p.category === 'string') {
          try {
            await db.collection('products').updateOne(
              { _id: p._id },
              { $set: { category: new mongoose.Types.ObjectId(p.category) } }
            );
            updatedCount++;
          } catch(e) {
             console.error("Failed to update product", p._id, e);
          }
        }
      }
      console.log(`Successfully updated ${updatedCount} products to use ObjectId for category.`);
      process.exit(0);
    } catch(err) {
      console.error(err);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
