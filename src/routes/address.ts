import { Router } from "express";
import * as AddressControllers from "../controllers/address";
import { authenticateToken } from "../controllers/auth";
import { verifyAuth } from "../middleware/verify-auth";

const addressRoutes = Router();

addressRoutes.use(verifyAuth);

addressRoutes.get("/address", authenticateToken, AddressControllers.getAddress);
addressRoutes.post(
  "/address",
  authenticateToken,
  AddressControllers.upsertAddress,
);
addressRoutes.put(
  "/address",
  authenticateToken,
  AddressControllers.updateAddress,
);
addressRoutes.delete(
  "/address",
  authenticateToken,
  AddressControllers.deleteAddress,
);

export default addressRoutes;
