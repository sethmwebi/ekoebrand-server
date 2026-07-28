import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  CreateRepairBookingSchema,
  UpdateRepairStatusSchema,
  UpdateRepairBookingSchema,
} from "../schemas/RepairBookingSchema";
import { RepairStatus } from "../../generated/prisma_client";

// Create a new repair booking
export const createRepairBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const {
      clothingType,
      clothingItem,
      brand,
      fabricType,
      color,
      size,
      repairTypes,
      description,
      images,
      specialInstructions,
      currentMeasurements,
      desiredMeasurements,
      urgency,
      preferredPickupDate,
      pickupLocationId,
    } = CreateRepairBookingSchema.parse(req.body);

    // Create the repair booking
    const repairBooking = await prisma.repairBooking.create({
      data: {
        userId: user.id,
        customerName: user.name || "",
        customerEmail: user.email,
        customerPhone: user.mobileNumber || "",
        clothingType,
        clothingItem,
        brand,
        fabricType,
        color,
        size,
        repairTypes,
        description,
        images: images || [],
        specialInstructions,
        currentMeasurements,
        desiredMeasurements,
        urgency: urgency || false,
        preferredPickupDate: preferredPickupDate
          ? new Date(preferredPickupDate)
          : null,
        pickupLocationId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        pickupLocation: true,
      },
    });

    res.status(201).json({
      message: "Repair booking created successfully",
      repairBooking,
    });
  } catch (error) {
    next(error);
  }
};

// Get all repair bookings for a user
export const getUserRepairBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const repairBookings = await prisma.repairBooking.findMany({
      where: {
        userId: user.id,
      },
      include: {
        pickupLocation: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(repairBookings);
  } catch (error) {
    next(error);
  }
};

// Get a single repair booking by ID
export const getRepairBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const repairBooking = await prisma.repairBooking.findFirst({
      where: {
        id,
        ...(user.role === "USER" ? { userId: user.id } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        pickupLocation: true,
      },
    });

    if (!repairBooking) {
      throw createHttpError(404, "Repair booking not found");
    }
    res.status(200).json(repairBooking);
  } catch (error) {
    next(error);
  }
};

// Update a repair booking
export const updateRepairBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const {
      clothingType,
      clothingItem,
      brand,
      fabricType,
      color,
      size,
      repairTypes,
      description,
      images,
      specialInstructions,
      currentMeasurements,
      desiredMeasurements,
      urgency,
      preferredPickupDate,
      pickupLocationId,
    } = UpdateRepairBookingSchema.parse(req.body);

    // Check if repair booking exists and user has permission
    const existingBooking = await prisma.repairBooking.findFirst({
      where: {
        id,
        ...(user.role === "USER" ? { userId: user.id } : {}),
      },
    });

    if (!existingBooking) {
      throw createHttpError(404, "Repair booking no found");
    }

    // Users can only update bookings in PENDING status
    if (user.role === "USER" && existingBooking.status !== "PENDING") {
      throw createHttpError(403, "Cannot update booking after confirmation");
    }

    const updatedBooking = await prisma.repairBooking.update({
      where: { id },
      data: {
        clothingType,
        clothingItem,
        brand,
        fabricType,
        color,
        size,
        repairTypes,
        description,
        images,
        specialInstructions,
        currentMeasurements,
        desiredMeasurements,
        urgency,
        preferredPickupDate: preferredPickupDate
          ? new Date(preferredPickupDate)
          : null,
        pickupLocationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        pickupLocation: true,
      },
    });

    res.status(200).json({
      message: "Repair booking updated successfully",
      repairBooking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

// Update repair booking status
export const updateRepairStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }

    const {
      status,
      estimatedCost,
      actualCost,
      depositPaid,
      tailorNotes,
      materialsUsed,
      completionTime,
      estimatedReadyDate,
    } = UpdateRepairStatusSchema.parse(req.body);

    const repairBooking = await prisma.repairBooking.update({
      where: { id },
      data: {
        status,
        estimatedCost,
        actualCost,
        depositPaid,
        tailorNotes,
        materialsUsed: materialsUsed || [],
        completionTime,
        estimatedReadyDate: estimatedReadyDate
          ? new Date(estimatedReadyDate)
          : null,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
          },
        },
        pickupLocation: true,
      },
    });

    res.status(200).json({
      message: "Repair status updated successfully",
      repairBooking,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel a repair booking
export const cancelRepairBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user?.id) {
      throw createHttpError(401, "User not authenticated");
    }

    const existingBooking = await prisma.repairBooking.findFirst({
      where: {
        id,
        ...(user.role === "USER" ? { userId: user.id } : {}),
      },
    });

    if (!existingBooking) {
      throw createHttpError(404, "Repair booking not found");
    }

    // Check if booking can be cancelled
    if (!["PENDING", "CONFIRMED"].includes(existingBooking.status)) {
      throw createHttpError(400, "Cannot cancel booking in current status");
    }

    const cancelledBooking = await prisma.repairBooking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Repair booking cancelled successfully",
      repairBooking: cancelledBooking,
    });
  } catch (error) {
    next(error);
  }
};

// Get all repair bookings
export const getAllRepairBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = status ? { status: status as RepairStatus } : {};

    const [repairBookings, total] = await Promise.all([
      prisma.repairBooking.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobileNumber: true,
            },
          },
          pickupLocation: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take,
      }),
      prisma.repairBooking.count({ where }),
    ]);

    res.status(200).json({
      repairBookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get repair booking statistics
export const getRepairStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }
    const stats = await prisma.repairBooking.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const totalRevenue = await prisma.repairBooking.aggregate({
      where: {
        status: "COMPLETED",
      },
      _sum: {
        actualCost: true,
      },
    });

    const monthlyStats = await prisma.repairBooking.groupBy({
      by: ["status"],
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _count: {
        id: true,
      },
    });

    res.status(200).json({
      statusStats: stats,
      totalRevenue: totalRevenue._sum.actualCost || 0,
      monthlyStats,
    });
  } catch (error) {
    next(error);
  }
};
