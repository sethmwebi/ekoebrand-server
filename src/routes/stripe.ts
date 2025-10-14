import express from "express";
import { handleStripeWebhook } from "../controllers/stripe"; // Adjust path

const router = express.Router();

router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }), // Parse raw body for Stripe signature
  handleStripeWebhook,
);

export default router;
