import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variant: {
        color: { type: String, default: "" },
        storage: { type: String, default: "" },
        ram: { type: String, default: "" }
    },

    qty: {
        type: Number,
        default: 1
    },

    price: {
        type: Number,
        required: true
    }
});
const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    items: [cartItemSchema],
    subtotal: {
        type: Number,
        required: true,
        default: 0
    }
}, { timestamps: true });

// Pre-save hook to calculate total
cartSchema.pre("save", async function() {
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((total, item) => total + (item.price * item.qty), 0);
    } else {
        this.subtotal = 0;
    }
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
