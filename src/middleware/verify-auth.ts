import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";

export const verifyAuth: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "Authentication required");
    }

    const userId = (req.user as { id: string }).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    // Attach user details to request for use in controllers
    req.user = {
      ...req.user,
      ...user,
    };

    next();
  } catch (error) {
    next(error);
  }
};
