import { NextFunction, Request, Response } from "express";

// Define the roles that are allowed to access the route
const allowedRoles = ["ADMIN", "SUPERADMIN"]; // Add or modify roles as needed

const verifyRoles = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if the user's role is included in the allowed roles
  if (allowedRoles.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ message: "Action is forbidden!" });
};

export default verifyRoles;
