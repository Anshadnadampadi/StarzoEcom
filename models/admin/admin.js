import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, 
    role: { type: String, enum: ['superadmin', 'editor', 'viewer'], default: 'viewer' },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now },
    resetPasswordToken: String,
    resetPasswordExpires: Date
}); 

export default mongoose.model('Admin', adminSchema);