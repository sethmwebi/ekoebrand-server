import { z } from "zod";

export const ProductSearchSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(10),
});

export type ProductSearchSchemaType = z.infer<typeof ProductSearchSchema>;
