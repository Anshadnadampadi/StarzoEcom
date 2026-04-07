// models/wishlistModel.js
import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },

            //  IMPORTANT (for your schema)
            variant: {
                color: String,
                storage: String,
                ram: String
            },

            addedAt: {
                type: Date,
                default: Date.now
            }
        }
    ]

}, { timestamps: true });

export default mongoose.model("Wishlist", wishlistSchema);