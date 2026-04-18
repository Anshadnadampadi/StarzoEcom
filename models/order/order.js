import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variant: {
            type: mongoose.Schema.Types.Mixed // Can be object with storage, color, ram or just a string
        },
        qty: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['Ordered', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Return Approved', 'Returned', 'Return Rejected'],
            default: 'Ordered'
        },
        returnReason: {
            type: String,
            default: null
        }
    }],
    shippingAddress: {
        fullName: String,
        phone: String,
        streetAddress: String,
        city: String,
        state: String,
        pinCode: String,
        country: { type: String, default: 'India' }
    },
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        default: 0
    },
    shippingFee: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['CASH ON DELIVERY', 'RAZORPAY', 'WALLET']
    },
    paymentStatus: {
        type: String,
        default: 'Pending',
        enum: ['Pending', 'Paid', 'Failed', 'Refunded']
    },
    orderStatus: {
        type: String,
        default: 'Pending',
        enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Return Approved', 'Return Picked', 'Returned', 'Return Rejected', 'Partially Returned']
    },
    couponCode: {
        type: String,
        default: null
    },
    cancellationReason: {
        type: String,
        default: null
    },
    returnReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// To match the admin view expectations (order.address.name)
orderSchema.virtual('status').get(function() {
    return this.orderStatus;
});

orderSchema.virtual('address').get(function() {
    return {
        name: this.shippingAddress.fullName,
        street: this.shippingAddress.streetAddress,
        city: this.shippingAddress.city,
        state: this.shippingAddress.state,
        pincode: this.shippingAddress.pinCode,
        phone: this.shippingAddress.phone
    };
});

// Ensure virtuals are included in JSON and Object
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order;
