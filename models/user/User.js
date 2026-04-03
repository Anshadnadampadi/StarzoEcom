import mongoose from "mongoose";

const userSchema = new mongoose.Schema({

  name: { type: String },
  displayName: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  gender: { type: String, enum: ['male','female','other','prefer_not'] },
  bio: { type: String },
  location: { type: String },
  website: { type: String },

  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  phone: { type: String },
  dob: { type: Date },
  avatar: { type: String },

  isGoogleUser: { type: Boolean, default: false },

  profileImage: {
    type: String,
    default: "/images/default-avatar.png"
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  otp: String,
  otpExpiry: Date,

  status: {
    type: Number,
    default: 1
  },

  isBlocked: {
    type: Boolean,
    default: false
  },

  isAdmin:{
    type:Boolean,
    default:false
  },


  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  referralCount: {
    type: Number,
    default: 0
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Address"
  }]

},{ timestamps: true });

export default mongoose.model("User", userSchema);