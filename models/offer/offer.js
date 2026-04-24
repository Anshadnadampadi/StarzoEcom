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
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
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

// Ensure either productId or categoryId is provided based on type
offerSchema.pre('save', function() {
    if (this.type === 'Product' && !this.productId) {
        throw new Error('Product ID is required for Product offer');
    }
    if (this.type === 'Category' && !this.categoryId) {
        throw new Error('Category ID is required for Category offer');
    }
});

export default mongoose.models.Offer || mongoose.model('Offer', offerSchema);
