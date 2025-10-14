// src/routes/index.ts
import { Router } from "express";
import { createPaymentIntent } from "../controllers/payment";

const router = Router();

router.post("/stripe/create-payment-intent", createPaymentIntent);

export default router;
