// src/schemas/PaymentSchema.ts
import { z } from "zod";

export const CreatePaymentIntentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});
