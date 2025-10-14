import { z } from "zod";

export const FiltersSchema = z.object({
  lowerBound: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().nonnegative().optional(),
  ),
  upperBound: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().nonnegative().optional(),
  ),
  categories: z.string().optional(),
  tags: z.string().optional(),
  sort: z.enum(["none", "asc", "desc", "newest"]).optional(),
});
