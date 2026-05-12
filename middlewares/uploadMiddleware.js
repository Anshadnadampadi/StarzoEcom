import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

// File filters
const imageFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  const extension = file.originalname.split('.').pop().toLowerCase();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif", "svg"];

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, PNG, WEBP, GIF, SVG) are allowed"), false);
  }
};

const videoFilter = (req, file, cb) => {
  const allowedTypes = ["video/mp4", "video/mpeg", "video/ogg", "video/webm", "video/quicktime"];
  const extension = file.originalname.split('.').pop().toLowerCase();
  const allowedExtensions = ["mp4", "mpeg", "ogg", "webm", "mov"];

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Only video files (MP4, WEBM, OGG, MOV) are allowed"), false);
  }
};

// ... (existing image storages)

// Video Storage
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "StarzoMobiles/videos",
    resource_type: "video", // CRITICAL for Cloudinary video support
    allowed_formats: ["mp4", "webm", "ogg", "mov"],
    public_id: (req, file) => `vid-${Date.now()}`
  }
});

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB for videos
  }
});

// Profile Image Storage
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "StarzoMobiles/profile",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) => `profile-${Date.now()}`
  }
});

export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// Category Icon Storage
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "StarzoMobiles/categories",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg"],
    public_id: (req, file) => `cat-${Date.now()}`
  }
});

export const uploadCategoryIcon = multer({
  storage: categoryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB
  }
});

// Product Image Storage
const productStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "StarzoMobiles/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    public_id: (req, file) => `prod-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  }
});

export const uploadProductImage = multer({
  storage: productStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
  }
});

