import { Router } from "express";
import * as AuthControllers from "../controllers/auth";
import passport from "passport";

const authRouter = Router();

authRouter.post("/auth/register", AuthControllers.register);
authRouter.post("/auth/login", AuthControllers.login);
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
authRouter.get("/auth/google/callback", AuthControllers.google);
authRouter.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] }),
);
authRouter.get("/auth/facebook/callback", AuthControllers.facebook);
authRouter.get("/twitter", passport.authenticate("twitter"));
authRouter.get("/auth/twitter/callback", AuthControllers.twitter);

authRouter.get("/auth/refresh", AuthControllers.refreshToken);

authRouter.get(
  "/auth/me",
  AuthControllers.authenticateToken,
  AuthControllers.getMe,
); // New endpoint
authRouter.get("/auth/validate", AuthControllers.validateToken);

//Password reset routes
authRouter.post("/auth/forgot-password", AuthControllers.requestPasswordReset);
authRouter.post("/auth/reset-password", AuthControllers.resetPassword);
authRouter.get(
  "/auth/validate-reset-token/:token",
  AuthControllers.validateResetToken,
);

// Verification routes
authRouter.get(
  "/auth/verification-status/:userId",
  AuthControllers.checkVerificationStatus,
);
authRouter.post("/auth/verify-account", AuthControllers.verifyAccount);
authRouter.post("/resend-verification", AuthControllers.resendVerification);
authRouter.post("/auth/logout", AuthControllers.logout);

export default authRouter;
