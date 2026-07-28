import { Router } from "express";
import * as RepairServiceController from "../controllers/repair-service";
import verifyAdmin from "../middleware/verify-admin";

const repairServiceRouter: Router = Router();

repairServiceRouter.get(
  "/repair-services",
  RepairServiceController.getRepairServices,
);

repairServiceRouter.post(
  "/repair-services/admin",
  verifyAdmin,
  RepairServiceController.createRepairService,
);
repairServiceRouter.put(
  "/repair-services/admin/:id",
  verifyAdmin,
  RepairServiceController.updateRepairService,
);
repairServiceRouter.delete(
  "/repair-services/admin/:id",
  verifyAdmin,
  RepairServiceController.deleteRepairService,
);

export default repairServiceRouter;
