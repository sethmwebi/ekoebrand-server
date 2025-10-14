import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import { OrderSchema, UpdateOrderSchema } from "../schemas/OrderSchema";
import { sendOrderConfirmation } from "./email";

enum OrderStatus {
  FAILED = "FAILED",
  PARTIALLY_FULLFILLED = "PARTIALLY_FULLFILLED",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  BACK_ORDERED = "BACK_ORDERED",
  ON_HOLD = "ON_HOLD",
  REFUNDED = "REFUNDED",
  RETURNED = "RETURNED",
  DELIVERED = "DELIVERED",
  SHIPPED = "SHIPPED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED",
  PROCESSING = "PROCESSING",
  PENDING = "PENDING",
}

// Type guard to check if a value is a string
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Get all orders (admin access)
export const getAllOrdersAdmin: RequestHandler = async (req, res, next) => {
  try {
    // Handle type-safe query parameter extraction
    let sortParam = "-createdAt"; // Default value

    // Safely handle the sort query parameter
    const sortQuery = req.query.sort;
    if (sortQuery) {
      if (isString(sortQuery)) {
        sortParam = sortQuery;
      } else if (
        Array.isArray(sortQuery) &&
        sortQuery.length > 0 &&
        isString(sortQuery[0])
      ) {
        sortParam = sortQuery[0];
      }
    }

    // Parse sort parameters
    const orderBy = sortParam.split(",").map((sortItem) => {
      const [field, direction] = sortItem.startsWith("-")
        ? [sortItem.substring(1), "desc" as const]
        : [sortItem, "asc" as const];

      return { [field]: direction };
    });

    const orders = await prisma.order.findMany({
      include: {
        items: true,
        payment: true,
      },
      orderBy,
    });

    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

// Get all orders for the logged-in user
export const getAllOrders: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "User not authenticated");
    }

    const orders = await prisma.order.findMany({
      where: { userId: (req.user as { id: string }).id }, // Filter by logged-in user's ID
      include: {
        items: true, // Optionally include order items
        payment: true, // Optionally include payment details
      },
    });
    res.status(200).json(orders);
  } catch (error) {
    next(error);
  }
};

// Get a single order by ID (restrict to user's orders)
export const getOrderById: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!req.user) {
      throw createHttpError(401, "User not authenticated");
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: (req.user as { id: string }).id, // Ensure it belongs to the user
      },
      include: {
        items: true,
        payment: true,
      },
    });

    if (!order) {
      throw createHttpError(404, "Order not found or you don’t have access!");
    }
    res.status(200).json(order);
  } catch (error) {
    next(error);
  }
};

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw createHttpError(401, "User not authenticated");
    }

    const orderData = OrderSchema.parse({
      ...req.body,
      userId: (req.user as { id: string }).id,
    });

    const order = await prisma.order.create({
      data: orderData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
        user: true,
      },
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatusAdmin: RequestHandler = async (
  req,
  res,
  next,
) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Validate status
    if (!Object.values(OrderStatus).includes(status)) {
      throw createHttpError(400, "Invalid order status");
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw createHttpError(404, "Order not found");
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: true,
        payment: true,
      },
    });

    res.status(200).json(updatedOrder);
  } catch (error) {
    next(error);
  }
};

// Delete an order (restrict to user's orders)
export const deleteOrder: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!req.user) {
      throw createHttpError(401, "User not authenticated");
    }

    const order = await prisma.order.findFirst({
      where: { id, userId: (req.user as { id: string }).id },
    });

    if (!order) {
      throw createHttpError(404, "Order not found or you don’t have access!");
    }

    await prisma.order.delete({ where: { id } });
    res.status(204).json({ message: "Order deleted successfully" });
  } catch (error) {
    next(error);
  }
};
