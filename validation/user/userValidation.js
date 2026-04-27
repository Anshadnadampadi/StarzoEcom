import joi from "joi"

// Base patterns
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,30}$/;

export const registerValidate = joi.object({

 firstName: joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Please enter your full name.',
            'any.required': 'Name is a required field.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 50 characters.'
        }),
    lastName: joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Please enter your full name.',
            'any.required': 'Name is a required field.',
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 50 characters.'
        }),
   email: joi.string()
    .pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
    .required()
    .messages({
        'string.empty': 'Please enter your email address.',
        'any.required': 'Email is a required field.',
        'string.pattern.base': 'Please enter a valid email address.'
    }),
      password: joi.string()
        .pattern(passwordPattern)
        .required()
        .messages({
            'string.empty': 'Please enter a password.',
            'any.required': 'Password is a required field.',
            'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character.'
        }),
    agree: joi.boolean()
        .valid(true)
        .required()
        .messages({
            'any.only': 'You must agree to the terms and conditions.',
            'any.required': 'Agreement is required.'
        })
});

export const loginValidate = joi.object({
    email: joi.string()
        .email()
        .required()
        .messages({
            'string.empty': 'Please enter your email address.',
            'any.required': 'Email is a required field.',
            'string.email': 'Please enter a valid email address.'
        }),
    password: joi.string()
        .required()
        .messages({
            'string.empty': 'Please enter your password.',
            'any.required': 'Password is a required field.'
        })
});

export const forgotPasswordValidate = joi.object({
    email: joi.string()
    .email()
    .required()
    .messages({
        'string.empty': 'Please enter your email address.',
        'any.required': 'Email is a required field.',
        'string.email': 'Please enter a valid email address.'
    })
});

export const profileUpdateValidate = joi.object({
    id: joi.string()
        .hex()
        .length(24)
        .required()
        .messages({
            'string.empty': 'User ID is missing.',
            'any.required': 'User ID is a required field.',
            'string.hex': 'Invalid User ID format.',
            'string.length': 'Invalid User ID length.'
        }),
    firstName: joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Please enter your first name.',
            'any.required': 'First name is a required field.',
            'string.min': 'First name must be at least 2 characters long.',
            'string.max': 'First name cannot exceed 50 characters.'
        }),
    lastName: joi.string()
        .min(1)
        .max(50)
        .allow('', null)
        .optional()
        .messages({
            'string.max': 'Last name cannot exceed 50 characters.'
        }),
    phone: joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.empty': 'Please enter your phone number.',
            'any.required': 'Phone number is a required field.',
            'string.pattern.base': 'Please enter a valid 10-digit phone number.'
        }),
    city: joi.string()
        .required()
        .messages({
            'string.empty': 'Please select a city from the dropdown.',
            'any.required': 'City is a required field.'
        }),
    bio: joi.string()
        .allow('', null)
        .optional()
        .messages({
            'string.base': 'Bio must be a string.'
        }),
    gender: joi.string()
        .valid('Male', 'Female', 'Other', 'Prefer not to say')
        .required()
        .messages({
            'string.empty': 'Please select your gender.',
            'any.required': 'Gender is a required field.',
            'any.only': 'Please select a valid gender option.'
        }),
    dob: joi.date()
        .max(new Date(new Date().setFullYear(new Date().getFullYear() - 18)))
        .messages({
            'date.base': 'Please enter a valid date of birth.',
            'date.max': 'You must be at least 18 years old.'
        })
        .allow('', null)
        .optional(),
    occupation: joi.string()
        .allow('', null)
        .optional()
        .messages({
            'string.base': 'Occupation must be a string.'
        })
});

export const editEmailValidate = joi.object({
    id: joi.string()
        .hex()
        .length(24)
        .required()
        .messages({
            'string.empty': 'User ID is missing.',
            'any.required': 'User ID is a required field.',
            'string.hex': 'Invalid User ID format.',
            'string.length': 'Invalid User ID length.'
        }),
    email: joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: false } })
        .required()
        .messages({
            'string.empty': 'Please enter your new email address.',
            'any.required': 'Email is a required field.',
            'string.email': 'Please enter a valid email address.'
        })
});

export const passwordUpdateValidate = joi.object({
    id: joi.string()
        .hex()
        .length(24)
        .required(),
    currentPassword: joi.string()
        .allow('', null)
        .optional()
        .messages({
            'string.empty': 'Please enter your current password.',
        }),
    newPassword: joi.string()
        .pattern(passwordPattern)
        .required()
        .messages({
            'string.empty': 'Please enter a new password.',
            'any.required': 'New password is a required field.',
            'string.pattern.base': 'Password must contain uppercase, lowercase, number and special character and be at least 8 characters long.'
        }),
    confirmPassword: joi.any()
        .valid(joi.ref('newPassword'))
        .required()
        .messages({
            'any.only': 'Confirm password does not match the new password.',
            'any.required': 'Please confirm your new password.'
        })
});

export const addressValidate = joi.object({
    type: joi.string()
        .valid('Home', 'Work', 'Other')
        .required()
        .messages({ 'any.only': 'Address type must be Home, Work, or Other.' }),
    name: joi.string()
        .min(2)
        .max(80)
        .pattern(/^[A-Za-z][A-Za-z .'-]{1,79}$/)
        .required()
        .messages({ 'string.pattern.base': 'Full name must be 2 to 80 characters and start with a letter.' }),
    phone: joi.string()
        .pattern(/^\+?[0-9()\-\s]{7,20}$/)
        .required()
        .messages({ 'string.pattern.base': 'Enter a valid phone number (7-15 digits).' }),
    addr1: joi.string()
        .min(5)
        .max(120)
        .pattern(/^[A-Za-z0-9][A-Za-z0-9\s,./#'()-]{4,119}$/)
        .required()
        .messages({ 'string.pattern.base': 'Address line 1 must be 5 to 120 characters.' }),
    addr2: joi.string()
        .max(120)
        .pattern(/^[A-Za-z0-9][A-Za-z0-9\s,./#'()-]{0,119}$/)
        .allow('', null)
        .optional(),
    city: joi.string()
        .pattern(/^[A-Za-z][A-Za-z .'-]{1,59}$/)
        .required()
        .messages({ 'string.pattern.base': 'Enter a valid city name.' }),
    state: joi.string()
        .pattern(/^[A-Za-z][A-Za-z .'-]{1,59}$/)
        .required()
        .messages({ 'string.pattern.base': 'Enter a valid state or province.' }),
    zip: joi.string()
        .pattern(/^[A-Za-z0-9][A-Za-z0-9 -]{2,10}$/)
        .required()
        .messages({ 'string.pattern.base': 'Enter a valid postal code.' }),
    country: joi.string()
        .pattern(/^[A-Za-z][A-Za-z .'-]{1,59}$/)
        .invalid('Other', 'other')
        .required()
        .messages({ 'any.invalid': 'Please select a supported country.' }),
    default: joi.boolean()
        .optional(),
    id: joi.string()
        .allow('', null)
        .optional(),
    _id: joi.string()
        .allow('', null)
        .optional()
}).unknown(true);

export const resetPasswordValidate = joi.object({
    email: joi.string().email({ minDomainSegments: 2, tlds: { allow: false } }).required(),
    password: joi.string().pattern(passwordPattern).required().messages({
        'string.empty': 'Please enter a password.',
        'string.pattern.base': 'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character.'
    }),
    confirmPassword: joi.string().valid(joi.ref('password')).required().messages({
        'any.only': 'Passwords do not match.',
        'any.required': 'Please confirm your password.'
    }),

 
});
