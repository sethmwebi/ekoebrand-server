import { Router } from "express";
import * as AddressControllers from "../controllers/address";
import { authenticateToken } from "../controllers/auth";

const addressRoutes = Router();

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
