import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Home', 'Work', 'Other'],
        default: 'Home'
    },

    name: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    addr1: {
        type: String,
        required: true
    },

    addr2: String,

    city: {
        type: String,
        required: true
    },

    state: {
        type: String,
        required: true
    },

    zip: {
        type: String,
        required: true
    },

    country: {
        type: String,
        default: "India"
    },

    default: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

export default mongoose.model("Address", addressSchema);        