import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  CreateAddressSchema,
  UpdateAddressSchema,
} from "../schemas/AddressSchema";

// Get user's first address
export const getAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const address = await prisma.address.findFirst({
      where: { userId: user.id },
    });

    if (!address) {
      throw createHttpError(404, "No address saved!");
    }

    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

// Create or update address (works with first address)
export const upsertAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const { street, city, county, postalCode, pickupLocation, country } =
      CreateAddressSchema.parse(req.body);

    // Find the first address for this user
    const existingAddress = await prisma.address.findFirst({
      where: { userId: user.id },
    });

    let address;
    if (existingAddress) {
      // Update the existing address
      address = await prisma.address.update({
        where: { id: existingAddress.id },
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
    } else {
      // Create new address
      address = await prisma.address.create({
        data: {
          street,
          city,
          county,
          postalCode,
          pickupLocation,
          country,
          userId: user.id,
        },
      });
    }

    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

// Update first address
export const updateAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const { street, city, county, postalCode, pickupLocation, country } =
      UpdateAddressSchema.parse(req.body);

    // Find the first address for this user
    const existingAddress = await prisma.address.findFirst({
      where: { userId: user.id },
    });

    if (!existingAddress) {
      throw createHttpError(404, "Address not found for this user");
    }

    const updatedAddress = await prisma.address.update({
      where: { id: existingAddress.id },
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

// Delete first address
export const deleteAddress = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    // Find the first address for this user
    const existingAddress = await prisma.address.findFirst({
      where: { userId: user.id },
    });

    if (!existingAddress) {
      throw createHttpError(404, "Address not found for this user");
    }

    await prisma.address.delete({
      where: { id: existingAddress.id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
