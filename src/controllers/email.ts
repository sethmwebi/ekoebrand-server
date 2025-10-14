import { RequestHandler } from "express";
import { prisma } from "..";
import {
  OrderConfirmationSchema,
  ShippingNotificationSchema,
  PasswordResetSchema,
  AccountVerificationSchema,
  PromotionalEmailSchema,
  AbandonedCartSchema,
} from "../schemas/EmailSchema";
import { resend } from "../utils/resend-client";
import { User } from "../../generated/prisma_client";

interface EmailResult {
  success: boolean;
  email: any | null;
  error?: string;
  resendId?: string;
}

// Order Confirmation Email
export const sendOrderConfirmation: RequestHandler = async (req, res, next) => {
  try {
    const { orderId } = OrderConfirmationSchema.parse(req.body);

    // Fetch order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Generate email content
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

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: "Your Store <sethmwebi27@gmail.com>",
      to: order.user.email,
      subject,
      html: htmlContent,
    });

    // Create email record
    const email = await prisma.email.create({
      data: {
        to: order.user.email,
        subject,
        template: "order-confirmation",
        content: htmlContent,
        resendId: data?.id,
        status: error ? "FAILED" : "SENT",
        error: error?.message,
        userId: order.userId,
        orderId: order.id,

        sentAt: new Date(),
      },
    });

    if (error) {
      return res.status(500).json({
        message: "Failed to send order confirmation email",
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      message: "Order confirmation email sent successfully",
      email,
      resendId: data?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Send shipping notification Email
export const sendShippingNotification: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { orderId, trackingNumber, carrier, estimatedDelivery } =
      ShippingNotificationSchema.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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

    const { data, error } = await resend.emails.send({
      from: "Your Store <sethmwebi27@gmail.com>",
      to: order.user.email,
      subject,
      html: htmlContent,
    });

    const email = await prisma.email.create({
      data: {
        to: order.user.email,
        subject,
        template: "shipping-notification",
        resendId: data?.id,
        content: htmlContent,
        status: error ? "FAILED" : "SENT",
        error: error?.message,
        userId: order.userId,
        orderId: order.id,
        sentAt: new Date(),
      },
    });

    if (error) {
      return res.status(500).json({
        message: "Failed to send shipping notification",
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      message: "Shipping notification sent successfully",
      email,
      resendId: data?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Password Reset Email
export const sendPasswordReset: RequestHandler = async (req, res, next) => {
  try {
    const {
      email: userEmail,
      resetToken,
      userId,
    } = PasswordResetSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subject = "Password Reset Request";
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
          .warning { color: #EF4444; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          
          <p><a href="${resetLink}" class="button">Reset Password</a></p>
          
          <p class="warning">This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
        </div>
      </body>
      </html>
    `;
    const { data, error } = await resend.emails.send({
      from: "Your Store <sethmwebi27@gmail.com>",
      to: userEmail,
      subject,
      html: htmlContent,
    });

    const email = await prisma.email.create({
      data: {
        to: userEmail,
        subject,
        template: "password-reset",
        resendId: data?.id,
        content: htmlContent,
        status: error ? "FAILED" : "SENT",
        error: error?.message,
        userId: user.id,
        sentAt: new Date(),
      },
    });

    if (error) {
      return res.status(500).json({
        message: "Failed to send password reset email",
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      message: "Password reset email sent successfully",
      email,
      resendId: data?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Account Verification Email
export const sendAccountVerification: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const {
      email: userEmail,
      verificationToken,
      userId,
    } = AccountVerificationSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subject = "Verify Your Account";
    const verificationLink = `${process.env.FRONTEND_URL}/verify-account?token=${verificationToken}`;

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

    const { data, error } = await resend.emails.send({
      from: "Your Store <sethmwebi27@gmail.com>",
      to: userEmail,
      subject,
      html: htmlContent,
    });

    const email = await prisma.email.create({
      data: {
        to: userEmail,
        subject,
        template: "account-verification",
        resendId: data?.id,
        content: htmlContent,
        status: error ? "FAILED" : "SENT",
        error: error?.message,
        userId: user.id,
        sentAt: new Date(),
      },
    });

    if (error) {
      return res.status(500).json({
        message: "Failed to send verification email",
        error: error.message,
        email,
      });
    }

    res.status(201).json({
      message: "Account verification email sent successfully",
      email,
      resendId: data?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Promotional Email
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
            from: "Your Store <sethmwebi27@gmail.com>",
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

// Abandoned Cart Reminder
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
      from: "Your store <sethmwebi27@gmail.com>",
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

// Helper function for user segementation (unchanged)
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
