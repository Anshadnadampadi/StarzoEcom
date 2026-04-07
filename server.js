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

const PORT = process.env.PORT || 7000

const app = express();
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

app.use(
    session({
        secret: process.env.SESSION_SECRET || "fallbackSecretKey",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            ttl: 24 * 60 * 60 // 1 day session persistence
        }),
        cookie: {
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        }
    })
);


app.use(passport.initialize());
app.use(passport.session());
app.use(checkBlocked);

app.use(async (req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.cartCount = 0;
    res.locals.breadcrumbs = [];
    if (req.session.user) {
        try {
            const cart = await Cart.findOne({ userId: req.session.user });
            if (cart) {
                res.locals.cartCount = cart.items.length;
            }
        } catch (error) {
            console.error("Error fetching cart count:", error);
        }
    }
    next();
});

console.log(process.env.MONGO_URI)
app.use(morgan('dev'))
app.use(nocache())
app.use("/", userRoutes);
app.use("/", productRoutes);
app.use("/wishlist",wishlistRoutes)

app.use("/admin", 
    nocache(),  
    (req, res, next) => {
        res.locals.layout = "layouts/admin";
        next();
    },
    adminRoutes
);



connectDB();

app.listen(PORT, () => {
    console.log(`server is running on http://localhost:${PORT}`)
})
