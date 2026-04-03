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
        ref: "Category"
    },


    stock: {
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
            images: [String]
        }
    ]

}, { timestamps: true })
export default mongoose.model("Product", productSchema)