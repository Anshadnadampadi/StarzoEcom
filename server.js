import dotenv from "dotenv";
dotenv.config();
import express from "express"
import { connect } from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import userRoutes from "./routes/user/userRoutes.js"
import adminRoutes from "./routes/admin/adminRoutes.js"
import userProductRoutes from "./routes/user/product/productRoutes.js";
import session from "express-session";
import MongoStore from "connect-mongo";
import connectDB from "./config/db.js"
import "./config/passport.js";
import passport from "passport";
import morgan from "morgan";
import googleStrategy from "passport-google-oauth20"
import nocache from "nocache"


const PORT=process.env.PORT||7000


const app=express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
//middleware
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set("view engine","ejs")
app.set("views", path.join(__dirname, "views"))
app.use(
    session({
        secret: "secretKey",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI
        })
    })
);

app.use(nocache())
app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
res.locals.user = req.session.user
next()
})

console.log(process.env.MONGO_URI)
app.use(morgan('dev'))
app.use("/",userRoutes);
app.use("/admin", adminRoutes);
app.use("/user", userProductRoutes);

connectDB();

app.listen(PORT,()=>{
    console.log(`server is running on ${PORT}`)
})
