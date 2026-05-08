import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['Product', 'Category'],
        required: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },
    productIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    categoryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Ensure either productIds or categoryIds are provided based on type
offerSchema.pre('save', async function() {
    if (this.type === 'Product' && (!this.productIds || this.productIds.length === 0)) {
        throw new Error('At least one Product ID is required for Product offer');
    }
    if (this.type === 'Category' && (!this.categoryIds || this.categoryIds.length === 0)) {
        throw new Error('At least one Category ID is required for Category offer');
    }
});

export default mongoose.models.Offer || mongoose.model('Offer', offerSchema);
