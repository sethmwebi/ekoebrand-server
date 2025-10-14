import { Router } from "express";
import * as OrderControllers from "../controllers/orders";
import { authenticateToken } from "../controllers/auth";

const ordersRouter: Router = Router();

ordersRouter.get("/orders", authenticateToken, OrderControllers.getAllOrders);
ordersRouter.get("/orders/admin", OrderControllers.getAllOrdersAdmin);
ordersRouter.get(
  "/order/:id",
  authenticateToken,
  OrderControllers.getOrderById,
);
ordersRouter.post("/order", authenticateToken, OrderControllers.createOrder);

ordersRouter.patch(
  "/admin/orders/:id/status",
  OrderControllers.updateOrderStatusAdmin,
);

export default ordersRouter;
