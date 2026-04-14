
// import fs from 'fs';

// /**
//  * Middleware to handle validation errors
//  */
// export const handleValidationErrors = (req, res, next) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         // Clean up uploaded files if validation fails
//         if (req.file) {
//             if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
//         }
//         if (req.files) {
//             req.files.forEach(file => {
//                 if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
//             });
//         }

//         return res.status(400).json({
//             success: false,
//             message: errors.array()[0].msg,
//             errors: errors.array()
//         });
//     }
//     next();
// };

// /**
//  * Category Validation Rules
//  */
// export const categoryValidation = [
//     body('name')
//         .notEmpty().withMessage('Category name is required')
//         .trim()
//         .matches(/^[A-Za-z&-]+(?: [A-Za-z&-]+)*$/).withMessage('Invalid Name')
//         .isLength({ min: 3, max: 50 }).withMessage('Name must be between 3 and 50 characters'),

    
//     body('slug')
//         .notEmpty().withMessage('Slug is required')
//         .trim()
//         .toLowerCase()
//         .matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric and hyphens only'),
    
//     body('displayOrder')
//         .optional({ checkFalsy: true })
//         .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
    
//     body('metaDescription')
//         .optional({ checkFalsy: true })
//         .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters')
// ];

// /**
//  * Product Validation Rules
//  */
// export const productValidation = [
//     body('name')
//         .notEmpty().withMessage('Product name is required')
//         .trim()
//         .matches(/^[A-Za-z&-]+(?: [A-Za-z0-9&-]+)*$/).withMessage('Invalid Name')
//         .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
//         .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
    
//     body('brand')
//         .notEmpty().withMessage('Brand is required')
//         .matches(/^[A-Za-z&-]+(?: [A-Za-z&-]+)*$/).withMessage('Invalid Brand')
//         .trim(),
    
//     body('category')
//         .notEmpty().withMessage('Category is required')
//         .trim(),
    
//     body('price')
//         .notEmpty().withMessage('Price is required')
//         .isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
    
//     body('stock')
//         .notEmpty().withMessage('Stock is required')
//         .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
// ];

