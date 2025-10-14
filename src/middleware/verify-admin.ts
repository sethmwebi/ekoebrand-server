import { NextFunction, Request, Response } from "express";

const verifyAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role === "ADMIN") {
    return next();
  }

  return res.status(403).json({ message: "Admin access required" });
};

export default verifyAdmin;
