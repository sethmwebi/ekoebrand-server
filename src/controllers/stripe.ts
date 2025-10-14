import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import Stripe from "stripe";
import { prisma } from "..";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // verify the webhook signature
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      throw createHttpError(400, "Missing Stripe signature");
    }

    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    // Handle charge.suceeded event
    if (event.type === "charge.succeeded") {
      const charge = event.data.object as Stripe.Charge;
      const userId = charge.metadata.userId;
      const amountPaidInCents = charge.amount;

      if (!userId) {
        throw createHttpError(400, "Missing userId in charge metadata");
      }

      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw createHttpError(400, "No items found in the cart");
      }

      const totalPrice = cartItems.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0,
      );

      await prisma.$transaction(async (prisma) => {
        // Create the Order
        const order = await prisma.order.create({
          data: {
            userId,
            totalPrice,
            status: "PROCESSING",
            items: {
              create: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
        });

        // Create the Payment record
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: amountPaidInCents,
            currency: "KES",
            status: "COMPLETED",
          },
        });

        // Clear the cart after successful payment
        await prisma.cartItem.deleteMany({ where: { userId } });
      });
      res.status(200).json({ message: "Webhook processed successfully" });
    } else {
      // Handle other event types if needed
      res.status(200).json({ message: "Event type not handled" });
    }
  } catch (error) {
    next(error);
  }
};
