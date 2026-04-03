import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads", "profile");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // folder to store images
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter (allow only images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Multer instance for Profile
export const uploadProfileImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

// Category Icon Storage
const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "uploads", "categories");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = "cat-" + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

export const uploadCategoryIcon = multer({
  storage: categoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB
  }
});
// Product Image Storage
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "uploads", "products");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = "prod-" + Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

export const uploadProductImage = multer({
  storage: productStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
  }
});
