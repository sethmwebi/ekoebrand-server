import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  CreateAddressSchema,
  UpdateAddressSchema,
} from "../schemas/AddressSchema";

// Get user's address
export const getAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user; // From requireAuth middleware
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }
    const userId = (req.user as { id: string }).id;

    const address = await prisma.address.findUnique({
      where: { userId },
    });

    if (!address) {
      throw createHttpError(404, "No address saved!");
    }

    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

// Create or update address (upsert)
export const upsertAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user; // From requireAuth middleware
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const { street, city, county, postalCode, pickupLocation, country } =
      CreateAddressSchema.parse(req.body);

    const address = await prisma.address.upsert({
      where: { userId: user.id },
      update: {
        street,
        city,
        county,
        postalCode,
        pickupLocation,
        country,
        updatedAt: new Date(),
      },
      create: {
        street,
        city,
        county,
        postalCode,
        pickupLocation,
        country,
        userId: user.id,
      },
    });

    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

// Update address
export const updateAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user; // From requireAuth middleware
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const { street, city, county, postalCode, pickupLocation, country } =
      UpdateAddressSchema.parse(req.body);

    const existingAddress = await prisma.address.findUnique({
      where: { userId: user.id },
    });

    if (!existingAddress) {
      throw createHttpError(404, "Address not found for this user");
    }

    const updatedAddress = await prisma.address.update({
      where: { userId: user.id },
      data: {
        street,
        city,
        county,
        postalCode,
        pickupLocation,
        country,
        updatedAt: new Date(),
      },
    });

    res.status(200).json(updatedAddress);
  } catch (error) {
    next(error);
  }
};

// Delete address
export const deleteAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user; // From requireAuth middleware
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const userId = (req.user as { id: string }).id;

    const existingAddress = await prisma.address.findUnique({
      where: { userId },
    });

    if (!existingAddress) {
      throw createHttpError(404, "Address not found for this user");
    }

    await prisma.address.delete({
      where: { userId },
    });

    res.status(204).send(); // No content
  } catch (error) {
    next(error);
  }
};
