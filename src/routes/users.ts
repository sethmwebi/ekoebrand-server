import { Router } from "express";
import * as UsersController from "../controllers/users";
import { authenticateToken, validateToken } from "../controllers/auth";

const usersRouter = Router();

usersRouter.get("/users", UsersController.getAllUsers);
usersRouter.get("/users/:id", UsersController.getUserById);
usersRouter.post("/user/create", UsersController.createUser);
usersRouter.put("/user/update", authenticateToken, UsersController.updateUser);
usersRouter.patch("/users/:id", UsersController.updateUser);
usersRouter.delete(
  "/user/delete",
  authenticateToken,
  UsersController.deleteUser,
);
usersRouter.get("/user/me", authenticateToken, UsersController.getMe);
usersRouter.put(
  "/user/address/update",
  authenticateToken,
  UsersController.updateUserAddress,
);

usersRouter.post("/user/check-email", UsersController.checkEmailAvailability);
export default usersRouter;
