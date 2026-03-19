import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/user/User.js";
import addressSchema from "../models/user/Address.js";
import dotenv from "dotenv";
dotenv.config();



passport.use(
  new GoogleStrategy(
    {
      clientID:process.env.GOOGLE_CLIENT_ID,
      clientSecret:process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:7000/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile?.emails?.[0]?.value?.toLowerCase();
        if (!email) {
          return done(new Error("Google account email is unavailable"), null);
        }
        

        let user = await User.findOne({ email });

        if (user && user.isBlocked) {
          return done(null, false, { message: "Your account is blocked" });
        }

        if (!user) {
          const randomPassword = crypto.randomBytes(32).toString("hex");
          const hashedPassword = await bcrypt.hash(randomPassword, 10);

          user = await User.create({
            name: profile.displayName || email.split("@")[0],
            displayName: profile.displayName || "",
            email,
            password: hashedPassword,
            avatar: profile?.photos?.[0]?.value || "",
            isGoogleUser: true,
            isVerified: true,
          });
        } else if (!user.isGoogleUser) {
          user.isGoogleUser = true;
          if (!user.avatar && profile?.photos?.[0]?.value) {
            user.avatar = profile.photos[0].value;
          }
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user?._id ? user._id.toString() : null);
});

passport.deserializeUser(async (sessionUser, done) => {
  try {
    if (!sessionUser) {
      return done(null, null);
    }

    let user = null;

    // Current format: ObjectId string saved by serializeUser.
    if (typeof sessionUser === "string" && mongoose.Types.ObjectId.isValid(sessionUser)) {
      user = await User.findById(sessionUser);
      return done(null, user);
    }

    // Legacy format support: full object/profile may have been stored in session previously.
    if (typeof sessionUser === "object") {
      const objectId = sessionUser._id || sessionUser.id;
      const email =
        sessionUser.email || sessionUser?.emails?.[0]?.value || null;

      if (objectId && mongoose.Types.ObjectId.isValid(objectId)) {
        user = await User.findById(objectId);
        return done(null, user);
      }

      if (email) {
        user = await User.findOne({ email: String(email).toLowerCase() });
        return done(null, user);
      }
    }

    return done(null, null);
  } catch (error) {
    return done(error, null);
  }
});

export default passport;
