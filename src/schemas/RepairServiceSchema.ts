import { z } from "zod";

export const CreateRepairServiceSchema = z.object({
  serviceName: z.string().min(1, "Service name is required"),
  repairType: z.enum([
    "ALTERATION",
    "HEM_MENDING",
    "ZIPPER_REPLACEMENT",
    "BUTTON_REPLACEMENT",
    "PATCH_REPAIR",
    "SEAM_MENDING",
    "SIZE_ADJUSTMENT",
    "FABRIC_PATCHING",
    "TAILORING",
    "OTHER",
  ]),
  clothingType: z
    .enum([
      "SHIRT",
      "TROUSERS",
      "DRESS",
      "SKIRT",
      "JACKET",
      "COAT",
      "SUIT",
      "JEANS",
      "SWEATER",
      "OTHER",
    ])
    .optional(),
  fabricType: z
    .enum([
      "COTTON",
      "LINEN",
      "SILK",
      "WOOL",
      "POLYESTER",
      "DENIM",
      "KNIT",
      "LEATHER",
      "SUEDE",
      "OTHER",
    ])
    .optional(),
  description: z.string().optional(),
  baseCost: z.number().min(0, "Base cost must be positive"),
  complexity: z.enum(["SIMPLE", "MODERATE", "COMPLEX"]).optional(),
  estimatedTime: z.number().min(1).optional(),
});

export const UpdateRepairServiceSchema = CreateRepairServiceSchema.partial();
