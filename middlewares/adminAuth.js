export const adminAuth = (req, res, next) => {
    // Verify a session exists and has admin data
    if (req.session && req.session.admin) {
        // Touch the session on every request to refresh the TTL in MongoDB.
        // This prevents the session from expiring while the admin is actively working.
        req.session.touch();

        // Expose admin data to all views
        res.locals.admin = req.session.admin;
        return next();
    }

    // Log unexpected logouts (session exists but no admin data — indicates corruption)
    if (req.session) {
        console.warn(
            `[ADMIN AUTH] Session exists but missing admin data.`,
            `Path: ${req.originalUrl}`,
            `Session ID: ${req.sessionID}`,
            `Session keys: ${Object.keys(req.session).join(', ')}`
        );
    } else {
        console.warn(`[ADMIN AUTH] No session found. Path: ${req.originalUrl}`);
    }

    // Respond appropriately for AJAX vs. regular requests
    if (req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('multipart')) {
        return res.status(401).json({
            success: false,
            message: 'Session expired. Please log in again.',
            redirect: '/admin/login'
        });
    }

    return res.redirect('/admin/login');
};

export default adminAuth;