import { SerializedUser } from "./auth";

declare global {
  namespace Express {
    interface User extends SerializedUser {}

    interface Request {
      user?: User;
    }
  }
}
