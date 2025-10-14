import { Router } from "express";
import * as DashboardControllers from "../controllers/dashboard";

const dashboardRouter: Router = Router();

dashboardRouter.get("/dashboard", DashboardControllers.getDashboardData);

export default dashboardRouter;
