// src/schemas/AddressSchema.ts
import { z } from "zod";

const BaseAddressSchema = z.object({
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  county: z.string().min(1, "County is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  pickupLocation: z.string().optional(),
  country: z.string().default("Kenya"),
});

// For creating addresses (all required fields)
export const CreateAddressSchema = BaseAddressSchema;

// For updating addresses (all fields optional but at least one required)
export const UpdateAddressSchema = BaseAddressSchema.partial().refine(
  (data) => Object.values(data).some((val) => val !== undefined),
  { message: "At least one field must be provided for update" },
);
