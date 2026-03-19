import mongoose from "mongoose"

const productSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },

    brand:{
        type:String,
        required:true
    },

    category:{
        type:String,
        required:true
    },

    price:{
        type:Number,
        required:true,
        min:0
    },

    stock:{
        type:Number,
        default:0
    },

    isBlocked:{
        type:Boolean,
        default:false
    },

    isListed:{
        type:Boolean,
        default:true
    },

    images:[String]

},{timestamp:true})
export default mongoose.model("Product",productSchema)