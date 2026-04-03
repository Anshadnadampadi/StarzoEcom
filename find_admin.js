import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user/User.js';

dotenv.config();

async function findAdmin() {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ isAdmin: true });
    if (admin) {
        console.log('FOUND_ADMIN_EMAIL:', admin.email);
    } else {
        console.log('NO_ADMIN_FOUND');
    }
    await mongoose.connection.close();
}

findAdmin();
