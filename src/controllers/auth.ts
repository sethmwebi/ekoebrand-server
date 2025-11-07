import * as crypto from "crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { RegisterSchema } from "../schemas/RegisterSchema";
import { prisma } from "..";
import createHttpError from "http-errors";
import bcrypt from "bcryptjs";
import { LoginSchema } from "../schemas/LoginSchema";
import passport from "passport";
import jwt from "jsonwebtoken";
import { User } from "../../generated/prisma_client";
import {
  sendAccountVerificationEmail,
  sendPasswordResetEmail,
} from "../services/email-services";

export const register: RequestHandler = async (req, res, next) => {
  try {
    const result = RegisterSchema.parse(req.body);
    const {
      email,
      password,
      name,
      provider = "credentials",
      role = "USER",
    } = result;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw createHttpError(400, "User with this email address already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        accounts: {
          create: {
            type: "local",
            provider,
            providerAccountId: email,
          },
        },
      },
    });
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.verificationToken.create({
      data: {
        identifier: user.id,
        token: verificationToken,
        expires,
      },
    });

    // Generate auth tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "5m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "1d" },
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
      verificationToken:
        process.env.NODE_ENV === "development" ? verificationToken : undefined,
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = LoginSchema.parse(req.body);
    const { email, password } = result;

    const socialLoginAccount = await prisma.account.findFirst({
      where: { user: { email }, AND: { NOT: { provider: "credentials" } } },
    });

    if (socialLoginAccount) {
      throw createHttpError(400, "Social login required for this email");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw createHttpError(400, "Email could not be found!");
    }

    const validPassword = await bcrypt.compare(password, user.password!);
    if (!validPassword) {
      throw createHttpError(400, "Incorrect email or password");
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "5m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" },
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    // Get tokens
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader && authHeader.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    let userId: string | undefined;

    // Optionally verify access token (if provided) to get user ID
    if (accessToken) {
      try {
        const decodedAccess = jwt.verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET as string,
        ) as { id: string };
        userId = decodedAccess.id;
      } catch (accessError) {
        if (!(accessError instanceof jwt.TokenExpiredError)) {
          // If it's not an expiration error (e.g., invalid signature), log it but proceed
          console.log("Invalid access token:", accessError);
        }
        // Expired access token is fine; we'll use refresh token instead
      }
    }

    // Verify refresh token (if present) to get user ID and invalidate session
    if (refreshToken) {
      let decodedRefresh;
      try {
        decodedRefresh = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET as string,
        ) as { id: string };
        userId = decodedRefresh.id;
      } catch (refreshError) {
        if (!(refreshError instanceof jwt.TokenExpiredError)) {
          // If refresh token is invalid (not just expired), we can still clear it
          console.log("Invalid refresh token:", refreshError);
        }
        // Decode without verification to attempt cleanup
        decodedRefresh = jwt.decode(refreshToken) as { id: string };
        userId = decodedRefresh?.id;
      }

      // Clear refresh token from database if we have a user ID
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { refreshToken: null },
        });
      }
    }

    // Always clear the refresh token cookie, even if no tokens were valid
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      expires: new Date(0), // Expire immediately
    });

    // Success response
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

const handleOAuthCallback = async (
  err: any,
  user: User | false,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Parse state from frontend
    let returnPath = "/store";
    let frontendBase = "http://localhost:3000";

    if (req.query.state) {
      const state = JSON.parse(decodeURIComponent(req.query.state as string));
      returnPath = state.returnPath || returnPath;
      frontendBase = state.frontendBase || frontendBase;
    }

    if (err || !user) {
      const errorUrl = `${frontendBase}${returnPath.startsWith("/") ? "" : "/"}${returnPath}`;
      return res.redirect(
        `${errorUrl}?error=${err ? "auth_failed" : "no_user"}`,
      );
    }

    // Token generation
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "5m" },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "1d" },
    );

    // Update user in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Set HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: "/",
      domain:
        process.env.NODE_ENV === "production" ? ".yourdomain.com" : undefined,
    });

    // Build success URL with all parameters
    const successUrl = new URL(returnPath, frontendBase);
    successUrl.searchParams.set("accessToken", accessToken);
    successUrl.searchParams.set("email", encodeURIComponent(user.email));
    successUrl.searchParams.set(
      "name",
      encodeURIComponent(user.name || "Unnamed"),
    );
    successUrl.searchParams.set("userId", user.id);
    successUrl.searchParams.set("role", user.role);

    if (user.image) {
      successUrl.searchParams.set("image", encodeURIComponent(user.image));
    }

    return res.redirect(successUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Fallback error handling
    const fallbackUrl = new URL("/store", "http://localhost:3000");
    fallbackUrl.searchParams.set("error", "server_error");

    if (error instanceof Error) {
      fallbackUrl.searchParams.set(
        "message",
        encodeURIComponent(error.message),
      );
    }

    return res.redirect(fallbackUrl.toString());
  }
};

export const google: RequestHandler = (req, res, next) =>
  passport.authenticate(
    "google",
    { session: false },
    (err: Error | null, user: User | false, info?: any) =>
      handleOAuthCallback(err, user, req, res, next),
  )(req, res, next);

export const facebook: RequestHandler = (req, res, next) =>
  passport.authenticate(
    "facebook",
    { session: false },
    (err: Error | null, user: User | false, info?: any) =>
      handleOAuthCallback(err, user, req, res, next),
  )(req, res, next);

export const twitter: RequestHandler = (req, res, next) =>
  passport.authenticate(
    "twitter",
    { session: false },
    (err: Error | null, user: User | false, info?: any) =>
      handleOAuthCallback(err, user, req, res, next),
  )(req, res, next);

// Middleware to verify JWT
export const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return next(createHttpError(401, "No token provided"));

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET as string,
    (err, decoded) => {
      if (err) return next(createHttpError(403, "Invalid or expired token"));
      req.user = decoded as User; // Ensure JWT payload matches Prisma User
      next();
    },
  );
};

export const refreshToken: RequestHandler = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw createHttpError(401, "No refresh token provided");
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string,
    ) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, refreshToken },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      throw createHttpError(403, "Invalid refresh token");
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "5m" },
    );

    // Do NOT set accessToken in a cookie
    res.json({ accessToken, user });
  } catch (error) {
    next(error);
  }
};

// Validate token controller
export const validateToken: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    // Prefer refresh token if provided, fallback to header token
    const tokenToValidate = refreshToken || token;

    if (!tokenToValidate) {
      throw createHttpError(401, "No token provided");
    }

    // Verify as a refresh token
    const decoded = jwt.verify(
      tokenToValidate,
      process.env.REFRESH_TOKEN_SECRET as string,
    ) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, refreshToken: tokenToValidate },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      throw createHttpError(403, "Invalid or expired refresh token");
    }

    res.status(200).json({
      message: "Token is valid",
      user,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(createHttpError(401, "Token has expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createHttpError(401, "Invalid token"));
    }
    next(error);
  }
};

// Get current user data
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw createHttpError(401, "User not authenticated");
    const userId = (req.user as { id: string }).id; // Temporary assertion
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mobileNumber: true,
      },
    });
    if (!user) throw createHttpError(404, "User not found");
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const checkVerificationStatus: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createHttpError(400, "User ID is required");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw createHttpError(404, "User not found");
    }
    res.status(200).json({
      verified: !!user.emailVerified,
      email: user.email,
      userId: user.id,
      name: user.name,
      verifiedAt: user.emailVerified,
      accountCreated: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyAccount: RequestHandler = async (req, res, next) => {
  try {
    const { token, userId } = req.body;

    if (!token || !userId) {
      throw createHttpError(400, "Token and user ID are required");
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        identifier: userId,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!verificationToken) {
      throw createHttpError(400, "Invalid or expired verification token");
    }

    // Verify the user's account
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date(),
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
      },
    });

    // Delete the used verification token
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: userId,
        token: token,
      },
    });

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification: RequestHandler = async (req, res, next) => {
  try {
    const { email, userId } = req.body;

    if (!email || !userId) {
      throw createHttpError(400, "Email and user ID are required");
    }

    // Check if user exists and isn't already verified
    const user = await prisma.user.findUnique({
      where: { id: userId, email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
      },
    });

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (user.emailVerified) {
      throw createHttpError(400, "Account is already verified");
    }

    // Generate new verification token
    const verificationToken =
      Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Delete any existing tokens for this user
    await prisma.verificationToken.deleteMany({
      where: { identifier: userId },
    });

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: userId,
        token: verificationToken,
        expires,
      },
    });

    // Use your email service to send verification email
    const emailResult = await sendAccountVerificationEmail({
      email: user.email,
      verificationToken,
      userId: user.id,
    });

    if (!emailResult.success) {
      throw createHttpError(500, "Failed to send verification email");
    }

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully",
      verificationToken:
        process.env.NODE_ENV === "development" ? verificationToken : undefined,
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw createHttpError(400, "Email is required");
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a reset link has been sent",
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // Delete any existing reset tokens for this user
    await prisma.resetToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ used: true }, { expires: { lt: new Date() } }],
      },
    });

    // Create new reset token
    await prisma.resetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expires,
      },
    });

    // Use email service to send password reset email
    const emailResult = await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userId: user.id,
    });

    if (!emailResult.success) {
      console.error("Failed to send password reset email:", emailResult.error);
      throw createHttpError(500, "Failed to send password reset email");
    }

    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a reset link has been sent",
      resetToken:
        process.env.NODE_ENV === "development" ? resetToken : undefined,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      throw createHttpError(400, "Token and new password are required");
    }

    // Find the valid, unused reset token
    const resetToken = await prisma.resetToken.findFirst({
      where: {
        token,
        used: false,
        expires: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!resetToken) {
      throw createHttpError(
        400,
        "Invalid, expired, or already used reset token",
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password and mark token as used in a transaction
    await prisma.$transaction(async (tx) => {
      //Update user password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
        },
      });

      // Mark token as used
      await tx.resetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
        },
      });

      // Delete any other unused tokens for this user for security
      await tx.resetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          used: false,
        },
      });
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const validateResetToken: RequestHandler = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw createHttpError(400, "Token is required");
    }

    const resetToken = await prisma.resetToken.findFirst({
      where: {
        token,
        used: false,
        expires: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        userId: true,
        expires: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!resetToken) {
      throw createHttpError(400, "Invalid or expired reset token");
    }

    res.status(200).json({
      valid: true,
      userId: resetToken.userId,
      email: resetToken.user.email,
      name: resetToken.user.name,
      expires: resetToken.expires,
    });
  } catch (error) {
    next(error);
  }
};
