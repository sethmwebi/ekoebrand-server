import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";

export const requireVerifiedAccount: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "Authentication required");
    }

    const userId = (req.user as { id: string }).id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        email: true,
      },
    });

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (!user.emailVerified) {
      throw createHttpError(403, "Account verification required");
    }

    next();
  } catch (error) {
    next(error);
  }
};
