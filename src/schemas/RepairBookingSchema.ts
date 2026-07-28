import { z } from "zod";

export const CreateRepairBookingSchema = z.object({
  clothingType: z.enum([
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
  ]),
  clothingItem: z.string().min(1, "Clothing item is required"),
  brand: z.string().optional(),
  fabricType: z.enum([
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
  ]),
  color: z.string().optional(),
  size: z.string().optional(),
  repairTypes: z
    .array(
      z.enum([
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
    )
    .min(1, "At least one repair type is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  images: z.array(z.string().url()).optional(),
  specialInstructions: z.string().optional(),
  currentMeasurements: z.any().optional(),
  desiredMeasurements: z.string().optional(),
  urgency: z.boolean().default(false),
  preferredPickupDate: z.string().datetime().optional(),
  pickupLocationId: z.string().cuid().optional(),
});

export const UpdateRepairBookingSchema = CreateRepairBookingSchema.partial();

export const UpdateRepairStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "IN_PROGRESS",
    "WAITING_FOR_MATERIALS",
    "READY_FOR_PICKUP",
    "COMPLETED",
    "CANCELLED",
  ]),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  depositPaid: z.number().min(0).optional(),
  tailorNotes: z.string().optional(),
  materialsUsed: z.array(z.string()).optional(),
  completionTime: z.number().min(1).optional(),
  estimatedReadyDate: z.string().datetime().optional(),
});
