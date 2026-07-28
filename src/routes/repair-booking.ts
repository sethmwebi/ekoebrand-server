import { Router } from "express";
import * as RepairBookingController from "../controllers/repair-booking";

const repairBookingRouter: Router = Router();
import { verifyAuth } from "../middleware/verify-auth";
import verifyAdmin from "../middleware/verify-admin";

repairBookingRouter.use(verifyAuth);

repairBookingRouter.post(
  "/repair-bookings",
  RepairBookingController.createRepairBooking,
);
repairBookingRouter.get(
  "/repair-bookings",
  RepairBookingController.getUserRepairBookings,
);
repairBookingRouter.get(
  "/repair-bookings/:id",
  RepairBookingController.getRepairBooking,
);
repairBookingRouter.put(
  "/repair-bookings/:id",
  RepairBookingController.updateRepairBooking,
);
repairBookingRouter.patch(
  "/repair-bookings/:id/cancel",
  RepairBookingController.cancelRepairBooking,
);

repairBookingRouter.get(
  "/repair-bookings/admin/all",
  verifyAdmin,
  RepairBookingController.getAllRepairBookings,
);
repairBookingRouter.patch(
  "/repair-bookings/admin/:id/status",
  verifyAdmin,
  RepairBookingController.updateRepairStatus,
);
repairBookingRouter.get(
  "/repair-bookings/admin/stats",
  verifyAdmin,
  RepairBookingController.getRepairStats,
);

export default repairBookingRouter;
