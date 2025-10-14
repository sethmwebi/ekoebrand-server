import { RequestHandler } from "express";
import passport from "passport";
import { User } from "../../generated/prisma_client";

const auth: RequestHandler = (req, res, next) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: any, user: Partial<User> | false, info: any) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        // Handle specific error messages
        if (info && info.name === "TokenExpiredError") {
          return res.status(401).json({ message: "Token has expired" });
        } else if (info && info.name === "JsonWebTokenError") {
          return res.status(401).json({ message: "Invalid token" });
        } else if (info && info.message === "No auth token") {
          return res.status(401).json({ message: "Missing token" });
        } else {
          return res.status(401).json({ message: "Unauthorized" });
        }
      }

      // attach the user object to the request object

      const {
        password: _,
        createdAt,
        updatedAt,
        emailVerified,
        ...userData
      } = user;
      req.user = userData;
      next();
    },
  )(req, res, next);
};

export default auth;
