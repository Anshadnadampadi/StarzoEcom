import dotenv from "dotenv";
dotenv.config();
import express from "express"
import { connect } from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import userRoutes from "./routes/user/userRoutes.js"
import adminRoutes from "./routes/admin/adminRoutes.js"
import productRoutes from "./routes/products/productRoutes.js";
import Cart from "./models/cart/Cart.js";
import wishlistRoutes from "./routes/user/wishlistRoutes.js"
import supportRoutes from "./routes/user/supportRoutes.js"
import adminSupportRoutes from "./routes/admin/supportRoutes.js"
import session from "express-session";
import MongoStore from "connect-mongo";
import connectDB from "./config/db.js"
import "./config/passport.js";
import passport from "passport";
import morgan from "morgan";
import googleStrategy from "passport-google-oauth20"
import nocache from "nocache"
import { checkBlocked } from "./middlewares/authMiddleware.js";
import expressEjsLayouts from 'express-ejs-layouts';
import { setViewLocals } from "./middlewares/viewMiddleware.js";
import { reclaimStockFromPendingOrders } from "./services/common/orderCleanupService.js";
import aiRoutes from "./routes/aiRoutes.js";
import helmet from "helmet";


// Run order cleanup every 10 minutes
setInterval(() => {
    reclaimStockFromPendingOrders(30);
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 7000

import { createServer } from "http";
import { initSocket } from "./config/socket.js";

const app = express();
const httpServer = createServer(app);
const io = await initSocket(httpServer);

// Make io accessible globally via req if needed
app.set("io", io);

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'", "https:", "http:"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*.razorpay.com", "cdn.jsdelivr.net", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "blob:"],
            "script-src-elem": ["'self'", "'unsafe-inline'", "https:", "http:", "*.razorpay.com", "cdn.jsdelivr.net", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "blob:"],
            "script-src-attr": ["'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'", "https:", "http:", "fonts.googleapis.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net", "blob:"],
            "style-src-attr": ["'unsafe-inline'"],
            "font-src": ["'self'", "https:", "http:", "fonts.gstatic.com", "cdnjs.cloudflare.com", "data:"],
            "img-src": ["'self'", "data:", "blob:", "https:", "http:", "res.cloudinary.com", "*.cloudinary.com", "upload.wikimedia.org", "*.razorpay.com"],
            "connect-src": ["'self'", "https:", "http:", "*.razorpay.com", "cdn.jsdelivr.net", "ws:", "wss:"],
            "frame-src": ["'self'", "https:", "http:", "*.razorpay.com"],
            "object-src": ["'none'"],
            "worker-src": ["'self'", "blob:"],
            "upgrade-insecure-requests": null,
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    dnsPrefetchControl: { allow: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(expressEjsLayouts);
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
//middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");

// Session configurations for separate User and Admin sessions
const commonSessionOptions = {
    secret: process.env.SESSION_SECRET || "fallbackSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    }
};

const userSessionMiddleware = session({
    ...commonSessionOptions,
    name: "userSid",
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'userSessions',
        ttl: 24 * 60 * 60
    }),
    cookie: { ...commonSessionOptions.cookie, path: '/' }
});

const adminSessionMiddleware = session({
    ...commonSessionOptions,
    name: "adminSid",
    resave: true,  // Always resave to prevent silent TTL expiry mid-session
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'adminSessions',
        ttl: 24 * 60 * 60
    }),
    cookie: { ...commonSessionOptions.cookie, path: '/admin' }
});

// Selective Session Middleware Dispatcher
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) {
        adminSessionMiddleware(req, res, next);
    } else {
        userSessionMiddleware(req, res, next);
    }
});



// Passport is only for user (Google OAuth) auth — do NOT run it for admin routes
// to prevent session interference with the admin session store.
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) return next();
    passport.initialize()(req, res, next);
});
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) return next();
    passport.session()(req, res, next);
});
app.use(checkBlocked);

// setViewLocals fetches cart/wishlist counts — only meaningful for user-facing pages
app.use((req, res, next) => {
    if (req.path.startsWith('/admin')) return next();
    return setViewLocals(req, res, next);
});

// For admin routes: set minimal locals (toast only, no DB queries)
app.use((req, res, next) => {
    if (!req.path.startsWith('/admin')) return next();
    res.locals.user = null;
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    res.locals.breadcrumbs = [];
    if (req.session && req.session.toast) {
        res.locals.toast = req.session.toast;
        delete req.session.toast;
    } else {
        res.locals.toast = null;
    }
    if (req.query.msg) {
        res.locals.toast = {
            message: req.query.msg,
            type: req.query.icon || 'info'
        };
    }
    next();
});

console.log(process.env.MONGO_URI)
app.use(morgan('dev'))
// Global nocache removed for performance. Keep it only for sensitive routes.
app.use("/", userRoutes);
app.use("/api/ai",aiRoutes)
app.use("/", productRoutes);
app.use("/wishlist",wishlistRoutes)
app.use("/support", supportRoutes);

app.use("/admin", 
    nocache(),  
    (req, res, next) => {
        res.locals.layout = "layouts/admin";
        next();
    },
    adminRoutes
);

app.use("/admin/support", 
    nocache(),
    (req, res, next) => {
        res.locals.layout = "layouts/admin";
        next();
    },
    adminSupportRoutes
);
app.get("/ai-chat", (req, res) => {
    res.render("user/ai-chat");
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render("errors/404", {
        title: "Page Not Found",
        breadcrumbs: [{ label: '404', url: '#' }]
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("GLOBAL_ERROR:", err.stack || err.message || err);
    
    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Internal Server Error",
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }

    res.status(err.status || 500).render("errors/error", {
        title: "Error Occurred",
        message: err.message || "An unexpected error occurred",
        error: process.env.NODE_ENV === 'development' ? err : {},
        breadcrumbs: [{ label: 'Error', url: '#' }]
    });
});

connectDB();

httpServer.listen(PORT, () => {

    console.log(`server is running on http://localhost:${PORT}`)
})

