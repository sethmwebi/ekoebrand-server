// src/schemas/CartSchema.ts
import { z } from "zod";

// Schema for getting a user's cart (validates req.params)
export const GetCartSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Schema for adding an item to the cart (validates req.body)
export const AddToCartSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

// Schema for removing an item from the cart (validates req.params)
export const RemoveFromCartSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  productId: z.string().min(1, "Product ID is required"),
});

// Schema for changing the quantity of an item in the cart (validates req.body)
export const ChangeQuantitySchema = z.object({
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});
