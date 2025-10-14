import { z } from "zod";
import { OrderStatus } from "../../generated/prisma_client";

export const OrderSchema = z.object({
  status: z
    .enum([
      "SCHEDULED",
      "FAILED",
      "PARTIALLY_FULLFILLED",
      "AWAITING_PAYMENT",
      "BACK_ORDERED",
      "ON_HOLD",
      "REFUNDED",
      "RETURNED",
      "DELIVERED",
      "SHIPPED",
      "CANCELLED",
      "COMPLETED",
      "PROCESSING",
      "PENDING",
    ])
    .default("PENDING"),
  totalPrice: z.number(),
  userId: z.string(),
  // items: z.array(
  //   z.object({
  //     quantity: z.number().default(1),
  //     productId: z.string(),
  //     orderId: z.string(),
  //   }),
  // ).optional(),
  // payment: z
  //   .enum([
  //     "PENDING",
  //     "CHARGEBACK",
  //     "VOIDED",
  //     "CAPTURED",
  //     "AUTHORIZED",
  //     "PARTIALLY_REFUNDED",
  //     "FAILED",
  //     "COMPLETED",
  //     "REFUNDED",
  //   ])
  //   .default("PENDING"),
});

export type OrderSchemaType = z.infer<typeof OrderSchema>;

export const UpdateOrderSchema = z
  .object({
    status: z.nativeEnum(OrderStatus),
    trackingNumber: z.string().optional(),
    carrier: z.string().optional(),
    estimatedDelivery: z
      .string()
      .transform((val) => new Date(val))
      .refine((val) => !isNaN(val.getTime()), {
        message: "Invalid date format",
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.status !== "SHIPPED" ||
      (data.trackingNumber && data.carrier && data.estimatedDelivery),
    {
      message:
        "Tracking number, carrier and estimated delivery are required for SHIPPED status",
      path: ["trackingNumber", "carrier", "estimatedDelivery"],
    },
  );

export type UpdateOrderSchemaType = z.infer<typeof UpdateOrderSchema>;
