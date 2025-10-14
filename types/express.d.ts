import { User } from "../../generated/prisma_client"; // Adjust path to your Prisma User

declare module "express" {
  export interface Request {
    user?: User;
  }
}
