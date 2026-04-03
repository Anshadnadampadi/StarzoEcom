import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/user/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

async function createTestAdmin() {
    await mongoose.connect(process.env.MONGO_URI);
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const testAdmin = new User({
        name: 'Test Admin',
        email: 'testadmin@starzo.com',
        password: hashedPassword,
        isAdmin: true,
        isVerified: true
    });
    try {
        await testAdmin.save();
        console.log('TEST_ADMIN_CREATED');
    } catch (e) {
        console.log('TEST_ADMIN_ALREADY_EXISTS');
    }
    await mongoose.connection.close();
}

createTestAdmin();
