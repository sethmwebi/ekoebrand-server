import { z } from "zod";

export const EmailCreateSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  template: z.string().optional(),
  content: z.string().min(1),
  status: z
    .enum([
      "PENDING",
      "SENT",
      "FAILED",
      "RETRYING",
      "BOUNCED",
      "DELIVERED",
      "OPENED",
      "CLICKED",
    ])
    .optional(),
  userId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  scheduledAt: z.date().optional(),
});

export const EmailUpdateSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "SENT",
      "FAILED",
      "RETRYING",
      "BOUNCED",
      "DELIVERED",
      "OPENED",
      "CLICKED",
    ])
    .optional(),
  retryCount: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const EmailQuerySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "SENT",
      "FAILED",
      "RETRYING",
      "BOUNCED",
      "DELIVERED",
      "OPENED",
      "CLICKED",
    ])
    .optional(),
  to: z.string().optional(),
  userId: z.string().cuid().optional(),
  orderId: z.string().cuid().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const OrderConfirmationSchema = z.object({
  orderId: z.string().cuid(),
  userId: z.string().cuid(),
});

export const ShippingNotificationSchema = z.object({
  orderId: z.string().cuid(),
  trackingNumber: z.string(),
  carrier: z.string(),
  estimatedDelivery: z.date(),
});

export const PasswordResetSchema = z.object({
  email: z.string().email(),
  resetToken: z.string(),
  userId: z.string().cuid(),
});

export const AccountVerificationSchema = z.object({
  email: z.string().email(),
  verificationToken: z.string(),
  userId: z.string().cuid(),
});

export const PromotionalEmailSchema = z.object({
  subject: z.string().min(1),
  content: z.string().min(1),
  userIds: z.array(z.string().cuid()).optional(),
  segment: z
    .enum(["all-users", "recent-purchasers", "active-users", "inactive-users"])
    .optional(),
});

export const AbandonedCartSchema = z.object({
  userId: z.string().cuid(),
  cartItems: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().positive(),
        product: z.object({
          name: z.string(),
          price: z.number(),
        }),
      }),
    )
    .optional(),
});
