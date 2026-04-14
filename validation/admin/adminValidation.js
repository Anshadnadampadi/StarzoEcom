import joi from 'joi';

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const adminLoginValidate = joi.object({
    email: joi.string()
        .pattern(emailPattern)
        .required()
        .messages({
            'string.empty': 'Administrator email is required.',
            'string.pattern.base': 'Please enter a valid administrator email address.'
        }),
    password: joi.string()
        .min(6)
        .required()
        .messages({
            'string.empty': 'Administrator password is required.',
            'string.min': 'Password must be at least 6 characters long.'
        })
});

export const categoryValidate = joi.object({
    id: joi.string().hex().length(24).optional(),
    name: joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Category name is required.',
            'string.min': 'Category name must be at least 2 characters long.',
            'string.max': 'Category name cannot exceed 50 characters.'
        }),
    slug: joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Slug must be lowercase alphanumeric with hyphens only.'
        }),
    displayOrder: joi.number()
        .integer()
        .min(0)
        .optional()
        .default(0),
    metaDescription: joi.string()
        .max(500)
        .allow('', null)
        .optional()
});

// export const productValidate = joi.object({
//     id: joi.string().hex().length(24).optional(),
//     name: joi.string().trim().min(3).max(100).required(),
//     brand: joi.string().trim().min(2).max(50).required(),
//     category: joi.string().hex().length(24).required(),
//     price: joi.number().positive().required(),
//     stock: joi.number().integer().min(0).required(),
//     description: joi.string().max(2000).allow('', null


export const productValidate = joi.object({
    id: joi.string()
        .hex()
        .length(24)
        .optional(),

    name: joi.string()
        .trim()
        .min(3)
        .max(100)
        .pattern(/^[a-zA-Z0-9\s\-()]+$/) // no weird symbols
        .required()
        .messages({
            "string.pattern.base": "Product name contains invalid characters"
        }),

    brand: joi.string()
        .trim()
        .min(2)
        .max(50)
        .pattern(/^[a-zA-Z0-9\s\-]+$/)
        .required(),

    category: joi.string()
        .hex()
        .length(24)
        .required(),

    price: joi.number()
        .precision(2) // max 2 decimal places
        .positive()
        .max(10000000) // prevent unrealistic values
        .required(),

    stock: joi.number()
        .integer()
        .min(0)
        .max(100000)
        .required(),

    description: joi.string()
        .trim()
        .max(2000)
        .allow("", null)
        .optional(),

    images: joi.array()
        .items(
            joi.string().uri().required()
        )
        .min(1)
        .max(10)
        .optional(),

    isListed: joi.boolean()
        .default(true)
});



export const variantValidate = joi.object({
    productId: joi.string()
        .hex()
        .length(24)
        .required(),

    color: joi.string()
        .trim()
        .min(2)
        .max(30)
        .pattern(/^[a-zA-Z\s\-]+$/)
        .required()
        .messages({
            'string.pattern.base': 'Color should only contain letters, spaces, and hyphens.'
        }),

    ram: joi.string()
        .trim()
        .pattern(/^\d+\s*(GB|MB|TB)$/i)
        .required()
        .messages({
            'string.pattern.base': 'RAM must be a valid format (e.g., 8 GB, 16GB).'
        }),

    storage: joi.string()
        .trim()
        .pattern(/^\d+\s*(GB|MB|TB)$/i)
        .required()
        .messages({
            'string.pattern.base': 'Storage must be a valid format (e.g., 128 GB, 1TB).'
        }),

    price: joi.number()
        .precision(2)
        .positive()
        .required()
        .messages({
            'number.positive': 'Price must be greater than zero.'
        }),

    stock: joi.number()
        .integer()
        .min(0)
        .max(10000)
        .required()
        .messages({
            'number.min': 'Stock cannot be negative.'
        }),

    sku: joi.string()
        .trim()
        .uppercase()
        .min(4)
        .max(25)
        .pattern(/^[A-Z0-9\-]+$/)
        .optional()
        .messages({
            'string.pattern.base': 'SKU should only contain uppercase letters, numbers, and hyphens.'
        })
});


export const userManagementValidate = joi.object({
    id: joi.string().hex().length(24).required(),
    name: joi.string().min(2).max(100).required(),
    email: joi.string().email().required()
});
