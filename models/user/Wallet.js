import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        amount: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        description: {
            type: String,
            required: true
        },
        txnId: {
            type: String,
            unique: true,
            sparse: true
        },
        orderId: {
            type: String
        },
        status: {
            type: String,
            enum: ['Success', 'Failed', 'Pending'],
            default: 'Success'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

export default mongoose.model('Wallet', walletSchema);
