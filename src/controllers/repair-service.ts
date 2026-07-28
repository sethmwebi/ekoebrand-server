import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  CreateRepairServiceSchema,
  UpdateRepairServiceSchema,
} from "../schemas/RepairServiceSchema";

export const getRepairServices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { clothingType, repairType, isActive } = req.query;

    const where: any = {};
    if (clothingType) where.clothingType = clothingType;
    if (repairType) where.repairType = repairType;
    if (isActive !== undefined) where.isActive = isActive === "true";
    const services = await prisma.repairService.findMany({
      where,
      orderBy: {
        serviceName: "asc",
      },
    });
    res.status(200).json(services);
  } catch (error) {
    next(error);
  }
};

// Create a new repair service template
export const createRepairService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }
    const {
      serviceName,
      repairType,
      clothingType,
      fabricType,
      description,
      baseCost,
      complexity,
      estimatedTime,
    } = CreateRepairServiceSchema.parse(req.body);
    const service = await prisma.repairService.create({
      data: {
        serviceName,
        repairType,
        clothingType,
        fabricType,
        description,
        baseCost,
        complexity,
        estimatedTime,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Repair service created successfully",
      service,
    });
  } catch (error) {
    next(error);
  }
};

// Update a repair service template
export const updateRepairService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }
    const { id } = req.params;
    const updateData = UpdateRepairServiceSchema.parse(req.body);

    const service = await prisma.repairService.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: "Repair service updated successfully",
      service,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a repair service
export const deleteRepairService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    if (!user?.id || (user.role !== "ADMIN" && user.role !== "SUPERADMIN")) {
      throw createHttpError(403, "Admin access required");
    }

    const { id } = req.params;
    await prisma.repairService.deleteMany({
      where: { id },
    });

    res.status(200).json({
      message: "Repair service deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
