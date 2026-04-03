// simple session‑based authentication helpers

import User from "../models/user/User.js";
import Address from "../models/user/Address.js";
/**
 * Ensure the user is logged in before allowing access to the route.
 * If not authenticated, redirect to the login page (or send 401 for API).
 */
export const ensureLoggedIn = async (req, res, next) => {
    try {

        if (!req.session || !req.session.user) {
            return res.redirect('/auth/login');
        }

        const user = await User.findById(req.session.user);
        // user deleted case
        if (!user) {
            if (req.session) delete req.session.user;
            return res.redirect('/auth/login');
        }

        // blocked user
        if (user.isBlocked) {
            if (req.session) delete req.session.user;
            return res.redirect('/auth/login?error=blocked');
        }

        return next();

    } catch (error) {
        console.error(error);
        return res.redirect('/auth/login');
    }
};

/**
 * Prevent logged in users from accessing routes like signup/login.
 * If they are already authenticated, send them to the home page.
 */
export const ensureLoggedOut = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/');

    }
    next();
};


/**
 * Check if the current logged-in user is blocked.
 * This can be used as a global middleware.
 */
export const checkBlocked = async (req, res, next) => {
    try {
        const path = req.originalUrl;
        const isAdminSession = !!(req.session && req.session.admin);

        // Security bypass: skip check for admin routes or anyone with an admin session
        if (path.startsWith('/admin') || isAdminSession) {
            return next();
        }

        const userId = req.session?.user || req.user?._id;

        if (userId) {
            const user = await User.findById(userId);
            
            // if (user) {
            //     console.log(`[SECURITY SCAN] User: ${user.email} | Blocked: ${user.isBlocked} | Status: ${user.status}`);
            // }

            // Critical identity verification
            if (user && user.isAdmin) {
                return next(); // Admins are always exempt from block checks
            }

            if (user && (user.isBlocked === true || user.status === 0)) {
                console.warn(`[ACL ENFORCEMENT] User Restricted: ${user.email}. Terminating access on path: ${path}`);

                // Recursive cleanup protocol: Logout then Destroy
                const cleanup = () => {
                   if (req.session) {
                       req.session.destroy((err) => {
                           if (err) console.error("Session cleanup failure:", err);
                           res.clearCookie('connect.sid', { path: '/' });
                           return res.redirect('/auth/login?error=blocked');
                       });
                   } else {
                       return res.redirect('/auth/login?error=blocked');
                   }
                };

                if (typeof req.logout === 'function') {
                    return req.logout((err) => {
                        if (err) console.error("Passport logout error:", err);
                        cleanup();
                    });
                }
                
                return cleanup();
            }
        }
        next();
    } catch (error) {
        console.error("Critical Security Middleware Failure:", error);
        next();
    }
};

// example usage in routes:
// import { ensureLoggedIn, ensureLoggedOut } from '../middlewares/authMiddleware.js';
//
// router.get('/profile', ensureLoggedIn, userProfileHandler);
// router.get('/signup', ensureLoggedOut, getSignup);

