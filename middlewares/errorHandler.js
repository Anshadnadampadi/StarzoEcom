/**
 * Global Error Handling Middleware
 * Handles all errors thrown in controllers/services and returns a consistent response.
 */
export const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.url}:`, err);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Mongo Duplicate Key Error (11000)
    if (err.code === 11000) {
        statusCode = 400;
        const field = Object.keys(err.keyValue)[0];
        message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    }

    // Handle Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // Handle Mongoose Cast Error (Invalid ID)
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (isAjax) {
        return res.status(statusCode).json({
            success: false,
            message: message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack
        });
    }

    // Default: Browser error page or generic fallback
    res.status(statusCode).render('errors/error', {
        message, 
        error: process.env.NODE_ENV === 'production' ? {} : err,
        breadcrumbs: [{ label: 'Error', url: '#' }]
    });
};


export const notFoundHandler = (req, res, next) => {
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    
    if (isAjax) {
        return res.status(404).json({
            success: false,
            message: `Route not found: ${req.originalUrl}`
        });
    }

    res.status(404).render('errors/404', {
        breadcrumbs: [{ label: 'Not Found', url: req.url }]
    });
};

