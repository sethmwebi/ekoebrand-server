import { Request, Response, NextFunction } from "express";

const verifySuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role === "SUPERADMIN") {
    return next();
  }

  return res.status(403).json({ message: "SuperAdmin access required" });
};

export default verifySuperAdmin;
