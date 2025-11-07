import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from ".."; // Adjust path as needed
import { resend } from "../utils/resend-client"; // Adjust path
import {
  OrderConfirmationSchema,
  ShippingNotificationSchema,
  PasswordResetSchema,
  AccountVerificationSchema,
  PromotionalEmailSchema,
  AbandonedCartSchema,
} from "../schemas/EmailSchema"; // Adjust path
import { OrderSchema, UpdateOrderSchema } from "../schemas/OrderSchema"; // Adjust path
import { User, OrderStatus } from "../../generated/prisma_client";

interface EmailResult {
  success: boolean;
  email: any | null; // Prisma email record
  error?: string;
  resendId?: string;
}

// Type guard to check if a value is a string
function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Email Service Functions
export async function sendOrderConfirmationEmail(
  orderId: string,
): Promise<EmailResult> {
  try {
    const parsed = OrderConfirmationSchema.parse({ orderId });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: { include: { product: true } },
        payment: true,
      },
    });

    if (!order) {
      return { success: false, email: null, error: "Order not found" };
    }

    const subject = `Order Confirmation - #${order.id.slice(-8).toUpperCase()}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; }
          .footer { background: #eee; padding: 10px; text-align: center; font-size: 12px; }
          .order-item { border-bottom: 1px solid #ddd; padding: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank you for your order!</h1>
          </div>
          <div class="content">
            <p><strong>Order Number:</strong> #${order.id.slice(-8).toUpperCase()}</p>
            <p><strong>Order Date:</strong> ${order.createdAt.toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> KSH ${order.totalPrice.toFixed(2)}</p>
            
            <h3>Order Items:</h3>
            ${order.items
              .map(
                (item) => `
              <div class="order-item">
                <strong>${item.product.name}</strong><br>
                Quantity: ${item.quantity} × KSH ${item.product.price}<br>
                Total: KSH ${(item.product.price * item.quantity).toFixed(2)}
              </div>
            `,
              )
              .join("")}
            
            <p><strong>Status:</strong> ${order.status}</p>
            <p>We'll notify you when your order ships.</p>
          </div>
          <div class="footer">
            <p>If you have any questions, contact us at support@yourstore.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error: resendError } = await resend.emails.send({
      from: "sethmwebi27@gmail.com",
      to: order.user.email,
      subject,
      html: htmlContent,
    });

    const emailRecord = await prisma.email.create({
      data: {
        to: order.user.email,
        subject,
        template: "order-confirmation",
        content: htmlContent,
        resendId: data?.id,
        status: resendError ? "FAILED" : "SENT",
        error: resendError?.message,
        userId: order.userId,
        orderId: order.id,
        sentAt: new Date(),
      },
    });

    if (resendError) {
      return { success: false, email: emailRecord, error: resendError.message };
    }

    return { success: true, email: emailRecord, resendId: data?.id };
  } catch (error: any) {
    return { success: false, email: null, error: error.message };
  }
}

export async function sendShippingNotificationEmail(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  estimatedDelivery: Date,
): Promise<EmailResult> {
  try {
    const parsed = ShippingNotificationSchema.parse({
      orderId,
      trackingNumber,
      carrier,
      estimatedDelivery,
    });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, items: { include: { product: true } } },
    });

    if (!order) {
      return { success: false, email: null, error: "Order not found" };
    }

    const subject = `Your order has shipped! - #${order.id.slice(-8).toUpperCase()}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .tracking-info { background: #F0F9FF; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your order is on the way! 🚚</h1>
          </div>
          <div class="content">
            <p><strong>Order Number:</strong> #${order.id.slice(-8).toUpperCase()}</p>
            
            <div class="tracking-info">
              <h3>Tracking Information</h3>
              <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
              <p><strong>Carrier:</strong> ${carrier}</p>
              <p><strong>Estimated Delivery:</strong> ${estimatedDelivery.toLocaleDateString()}</p>
            </div>

            <h3>Shipped Items:</h3>
            <ul>
              ${order.items
                .map(
                  (item) => `
                <li>${item.product.name} - ${item.quantity}</li>
              `,
                )
                .join("")}
            </ul>
            
            <p><a href="#" style="background: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Your Package</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error: resendError } = await resend.emails.send({
      from: "sethmwebi27@gmail.com",
      to: order.user.email,
      subject,
      html: htmlContent,
    });

    const emailRecord = await prisma.email.create({
      data: {
        to: order.user.email,
        subject,
        template: "shipping-notification",
        content: htmlContent,
        resendId: data?.id,
        status: resendError ? "FAILED" : "SENT",
        error: resendError?.message,
        userId: order.userId,
        orderId: order.id,
        sentAt: new Date(),
      },
    });

    if (resendError) {
      return { success: false, email: emailRecord, error: resendError.message };
    }

    return { success: true, email: emailRecord, resendId: data?.id };
  } catch (error: any) {
    return { success: false, email: null, error: error.message };
  }
}

// Order Controllers
// Get all orders (admin access)
export const getAllOrdersAdmin: RequestHandler = async (req, res, next) => {
  try {
    let sortParam = "-createdAt";
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
      where: { userId: (req.user as { id: string }).id },
      include: {
        items: true,
        payment: true,
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
        userId: (req.user as { id: string }).id,
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

// Create a new order (assign to logged-in user)
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

    // Send confirmation email
    const emailResult = await sendOrderConfirmationEmail(order.id);
    if (!emailResult.success) {
      console.error("Order confirmation email failed:", emailResult.error);
    }

    res.status(201).json({
      ...order,
      emailSent: emailResult.success,
      resendId: emailResult.resendId,
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (admin access)
export const updateOrderStatusAdmin: RequestHandler = async (
  req,
  res,
  next,
) => {
  const { id } = req.params;
  const { status, trackingNumber, carrier, estimatedDelivery } =
    UpdateOrderSchema.parse(req.body);

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw createHttpError(404, "Order not found");
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
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

    let emailResult: EmailResult | null = null;
    if (status === OrderStatus.SHIPPED) {
      if (!trackingNumber || !carrier || !estimatedDelivery) {
        throw createHttpError(
          400,
          "Tracking details required for SHIPPED status",
        );
      }
      const deliveryDate =
        typeof estimatedDelivery === "string"
          ? new Date(estimatedDelivery)
          : estimatedDelivery;
      if (isNaN(deliveryDate.getTime())) {
        throw createHttpError(400, "Invalid estimated delivery date");
      }
      emailResult = await sendShippingNotificationEmail(
        id,
        trackingNumber,
        carrier,
        deliveryDate,
      );
      if (!emailResult.success) {
        console.error("Shipping notification failed:", emailResult.error);
      }
    }

    res.status(200).json({
      ...updatedOrder,
      emailSent: !!emailResult?.success,
      resendId: emailResult?.resendId,
    });
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

// Add these to your existing email service file

export async function sendAccountVerificationEmail(data: {
  email: string;
  verificationToken: string;
  userId: string;
}): Promise<EmailResult> {
  try {
    const subject = "Verify Your Account";
    const verificationLink = `${process.env.FRONTEND_URL}/verify-account?token=${data.verificationToken}&userId=${data.userId}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
          .welcome { color: #4F46E5; font-size: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="welcome">Welcome to Our Store! 🎉</h1>
          <p>Thank you for creating an account. Please verify your email address to complete your registration:</p>
          
          <p><a href="${verificationLink}" class="button">Verify Email Address</a></p>
          
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "sethmwebi27@gmail.com",
      to: data.email,
      subject,
      html: htmlContent,
    });

    const emailRecord = await prisma.email.create({
      data: {
        to: data.email,
        subject,
        template: "account-verification",
        content: htmlContent,
        resendId: resendData?.id,
        status: resendError ? "FAILED" : "SENT",
        error: resendError?.message,
        userId: data.userId,
        sentAt: new Date(),
      },
    });

    if (resendError) {
      return { success: false, email: emailRecord, error: resendError.message };
    }

    return { success: true, email: emailRecord, resendId: resendData?.id };
  } catch (error: any) {
    return { success: false, email: null, error: error.message };
  }
}

export async function sendPasswordResetEmail(data: {
  email: string;
  resetToken: string;
  userId: string;
}): Promise<EmailResult> {
  try {
    const subject = "Password Reset Request";
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${data.resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .warning { color: #EF4444; font-size: 12px; margin-top: 20px; }
          .info { background: #F3F4F6; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          
          <p><a href="${resetLink}" class="button">Reset Password</a></p>
          
          <div class="info">
            <p><strong>Can't click the button?</strong> Copy and paste this link in your browser:</p>
            <p>${resetLink}</p>
          </div>
          
          <p class="warning">This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
        </div>
      </body>
      </html>
    `;

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "sethmwebi27@gmail.com",
      to: data.email,
      subject,
      html: htmlContent,
    });

    const emailRecord = await prisma.email.create({
      data: {
        to: data.email,
        subject,
        template: "password-reset",
        content: htmlContent,
        resendId: resendData?.id,
        status: resendError ? "FAILED" : "SENT",
        error: resendError?.message,
        userId: data.userId,
        sentAt: new Date(),
      },
    });

    if (resendError) {
      return { success: false, email: emailRecord, error: resendError.message };
    }

    return { success: true, email: emailRecord, resendId: resendData?.id };
  } catch (error: any) {
    return { success: false, email: null, error: error.message };
  }
}

export const sendPromotionalEmail: RequestHandler = async (req, res, next) => {
  try {
    const {
      subject: emailSubject,
      content: emailContent,
      userIds,
      segment,
    } = PromotionalEmailSchema.parse(req.body);

    let users;
    if (userIds && userIds.length > 0) {
      users = await prisma.user.findMany({
        where: { id: { in: userIds } },
      });
    } else if (segment) {
      users = await getUsersBySegement(segment);
    } else {
      return res
        .status(400)
        .json({ message: "Either userIds or segment must be provided" });
    }

    const results = await Promise.all(
      users.map(async (user: User) => {
        try {
          const { data, error } = await resend.emails.send({
            from: "sethmwebi27@gmail.com",
            to: user.email,
            subject: emailSubject,
            html: emailContent,
          });

          const email = await prisma.email.create({
            data: {
              to: user.email,
              subject: emailSubject,
              resendId: data?.id,
              template: "promotional",
              content: emailContent,
              status: error ? "FAILED" : "SENT",
              error: error?.message,
              userId: user.id,
              sentAt: new Date(),
            },
          });
          return {
            success: !error,
            email,
            error: error?.message,
            resendId: data?.id,
          };
        } catch (error: any) {
          return { success: false, error: error.message, email: null };
        }
      }),
    );

    const successful = results.filter((r: EmailResult) => r.success).length;
    const failed = results.filter((r: EmailResult) => !r.success).length;

    res.status(201).json({
      message: `Promotional emails sent: ${successful} successful, ${failed} failed`,
      total: users.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    next(error);
  }
};

export const sendAbandonedCartReminder: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { userId, cartItems } = AbandonedCartSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cartItem: {
          include: { product: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const items = cartItems || user.cartItem;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No cart items found" });
    }

    const subject = "Don't forget your items!";
    const total = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .offer { background: #FFEDD5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Your cart is waiting! ⏰</h2>
          <p>You have items in your shopping cart that you might be interested in:</p>
          
          <h3>Cart Items:</h3>
          <ul>
            ${items
              .map(
                (item) => `
              <li>${item.product.name} - ${item.quantity} x KSH ${item.product.price}</li>
            `,
              )
              .join("")}
          </ul>
          
          <p><strong>Total: KSH ${total.toFixed(2)}</strong></p>
          
          <div class="offer">
            <h3>Special Offer! 🎁</h3>
            <p>Use code <strong>CART10</strong> for 10% off your order!</p>
            <p>Offer expires in 24 hours.</p>
          </div>
          
          <p><a href="${process.env.FRONTEND_URL}/cart" class="button">Complete Your Purchase</a></p>
        </div>
      </body>
      </html>
    `;
    const { data, error } = await resend.emails.send({
      from: "sethmwebi27@gmail.com",
      to: user.email,
      subject,
      html: htmlContent,
    });

    const email = await prisma.email.create({
      data: {
        to: user.email,
        subject,
        template: "abandoned-cart",
        resendId: data?.id,
        content: htmlContent,
        status: error ? "FAILED" : "SENT",
        error: error?.message,
        userId: user.id,
        sentAt: new Date(),
      },
    });

    if (error) {
      res.status(500).json({
        message: "Failed to send abandoned cart reminder",
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      message: "Abandoned cart reminder sent successfully",
      email,
      resendId: data?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function for user segmentation
async function getUsersBySegement(segment: string) {
  switch (segment) {
    case "recent-purchasers":
      return await prisma.user.findMany({
        where: {
          orders: {
            some: {
              createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      });
    case "active-users":
      return await prisma.user.findMany({
        where: {
          orders: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      });
    case "inactive-users":
      return await prisma.user.findMany({
        where: {
          orders: {
            none: {
              createdAt: {
                gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      });
    default:
      return await prisma.user.findMany();
  }
}
