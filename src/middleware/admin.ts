import { RequestHandler } from "express";

const admin: RequestHandler = (req, res, next) => {
  if (req.user && req.user.role!) {
    return next();
  }
  return res.status(403).json({ message: "Action is forbidden!" });
};

export default admin;
