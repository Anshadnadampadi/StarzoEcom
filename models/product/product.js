import mongoose from "mongoose"

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    brand: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },

    stock: {
        type: Number,
        default: 0
    },

    reservedStock: {
        type: Number,
        default: 0
    },

    price: {
        type: Number,
        default: 0
    },

    description: {
        type: String,
        trim: true
    },

    specifications: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    highlights: [String],

    inTheBox: [String],

    isListed: {
        type: Boolean,
        default: true
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
 variants: [
    {
        color: {
            type: String,
            required: true
        },
        storage: {
            type: String,
            required: true
        },
        ram: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        stock: {
            type: Number,
            default: 0
        },
        reservedStock: {
            type: Number,
            default: 0
        },
        images: [String],

        
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        }
    }
]
 
}, { timestamps: true })

productSchema.pre('save', async function() {
    if (this.variants && this.variants.length > 0) {
        const activeVariants = this.variants.filter(v => !v.isDeleted);
        if (activeVariants.length > 0) {
            this.price = activeVariants[0].price;
            // Physical stock minus reserved stock = available stock shown to users
            this.reservedStock = activeVariants.reduce((sum, v) => sum + (v.reservedStock || 0), 0);
            this.stock = activeVariants.reduce((sum, v) => sum + (v.stock || 0) - (v.reservedStock || 0), 0);
        } else {
            this.stock = 0;
            this.reservedStock = 0;
        }
    }
});

export default mongoose.models.Product || mongoose.model("Product", productSchema);
