import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import Stripe from "stripe";
import { prisma } from ".."; // Adjust path to your Prisma client

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia", // Use the latest API version
  typescript: true,
});

export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.body; // Assuming userId is sent in the body

    if (!userId) {
      throw createHttpError(400, "User ID is required");
    }

    // Fetch cart items for the user
    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw createHttpError(400, "Cart is empty");
    }

    // Calculate total amount from cart items (in cents)
    const totalAmount = cartItems.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0,
    );

    if (totalAmount <= 0) {
      throw createHttpError(400, "Total amount must be greater than zero");
    }

    // Create a PaymentIntent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount, // Amount in cents
      currency: "KES", // Adjust currency as needed (e.g., "kes" for M-Pesa compatibility)
      automatic_payment_methods: {
        enabled: true, // Enables PaymentElement to handle multiple payment methods
      },
      metadata: { userId }, // Optional: store userId for reference
    });

    // Respond with the clientSecret
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      message: "Payment intent created successfully",
    });
  } catch (error) {
    next(error);
  }
};
