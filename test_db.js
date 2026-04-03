import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/StarzoMobiles')
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      const product = await db.collection('products').findOne({});
      console.log('Sample product category:', product.category, 'Type:', typeof product.category);
      if (product.category && product.category.constructor) {
          console.log('Constructor name:', product.category.constructor.name);
      }
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
