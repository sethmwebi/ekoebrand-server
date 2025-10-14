import { z } from "zod";

// Schema for creating a new tag
export const TagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
  description: z.string().max(200, "Description is too long").optional(),
});

// Schema for updating an existing tag
export const UpdateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name is too long")
    .optional(),
  description: z.string().max(200, "Description is too long").optional(),
});

// Type inference for TypeScript
export type TagSchemaType = z.infer<typeof TagSchema>;
export type UpdateTagSchemaType = z.infer<typeof UpdateTagSchema>;
