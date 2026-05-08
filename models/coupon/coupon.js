import mongoose from "mongoose";



const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },

    discountType: {
        type: String,
        enum: ["fixed", "percentage"],
        required: true
    },

    discountValue: { type: Number, required: true },

    minAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },

    expiryDate: { type: Date, required: true },

    usageLimit: { type: Number, default: 1 },
    perUserLimit: { type: Number, default: 1 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isActive: { type: Boolean, default: true },

    isFirstTimeUser: { type: Boolean, default: false },

    category: { type: String }, // optional (advanced)

}, { timestamps: true });

export default mongoose.model("Coupon", couponSchema);