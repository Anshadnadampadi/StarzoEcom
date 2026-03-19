import mongoose from "mongoose"

const categorySchema = new mongoose.Schema({
   name: {
      type: String,
      required: true,
      trim: true
   },
   slug: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true 
   },
   icon: { type: String, default: 'category' },

   displayOrder: { type: Number, default: 0 },
   metaDescription: { type: String },
   isUnlisted: { type: Boolean, default: false }
}, { 
    timestamps: true // This automatically creates 'createdAt' and 'updatedAt' as Dates
});

export default mongoose.model("Category", categorySchema);

