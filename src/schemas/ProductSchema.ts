import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().min(0, "Price must be non-negative"),
  stock: z.number().int().min(0, "Stock must be a non-negative integer"),
  categoryId: z.string().optional(), // Optional category ID
  tagIds: z.array(z.string()).optional(), // Optional array of tag IDs
});

export type ProductSchemaType = z.infer<typeof ProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().min(1, "Description is required").optional(),
  price: z.number().min(0, "Price must be non-negative").optional(),
  stock: z
    .number()
    .int()
    .min(0, "Stock must be a non-negative integer")
    .optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export type UpdateProductSchemaType = z.infer<typeof UpdateProductSchema>;
