import { z } from "zod";

export const DashboardSchema = z.object({
  userId: z.string().uuid(),
});
