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
            return res.redirect('/login');
        }

        const user = await User.findById(req.session.user);
        console.log(user)
        // user deleted case
        if (!user) {
            req.session.destroy(() => { });
            return res.redirect('/login');
        }

        // blocked user
        if (user.isBlocked) {
            req.session.destroy(() => { });
            return res.redirect('/login');
        }

        return next();

    } catch (error) {
        console.error(error);
        return res.redirect('/login');
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


// example usage in routes:
// import { ensureLoggedIn, ensureLoggedOut } from '../middlewares/authMiddleware.js';
//
// router.get('/profile', ensureLoggedIn, userProfileHandler);
// router.get('/signup', ensureLoggedOut, getSignup);

