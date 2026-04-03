import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    variant: {
        type: String, // Or ObjectId if variants are stored in a separate collection. The current codebase seems to have them as embedded objects or strings.
        required: false
    },
    qty: {
        type: Number,
        required: true,
        min: 1,
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
