import "dotenv/config";
import express, { Express, NextFunction, Request, Response } from "express";
import { Server, Socket } from "socket.io";
import morgan from "morgan";
import createHttpError, { isHttpError } from "http-errors";
import productsRoute from "./routes/products";
import { ZodError } from "zod";
import { formatZodError } from "./utils/format-errors";
import ordersRoute from "./routes/orders";
import passport from "passport";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoute from "./routes/auth";
import cartRoute from "./routes/cart";
import usersRoute from "./routes/users";
import cors from "cors";
import { PrismaClient } from "../generated/prisma_client";
import categoriesRoute from "./routes/categories";
import tagsRoute from "./routes/tags";
import addressRoute from "./routes/address";
import paymentRoute from "./routes/payment";
import stripeRoute from "./routes/stripe";
import mpesaRoute from "./routes/mpesa";
import dashboardRoute from "./routes/dashboard";
import searchProductsRoute from "./routes/search-products";
import emailsRoute from "./routes/email";
import envalid from "./utils/validEnv";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";

require("./utils/passport-config.ts");

const app: Express = express();

const server = app.listen(envalid.PORT || 8000, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${envalid.PORT || 8000}`);
});
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  }),
);
app.options("*", cors());

export const prisma = new PrismaClient({ log: ["query"] });

app.use("/v1/api", stripeRoute);
app.use(express.json());
app.use("/v1/api/mpesa", mpesaRoute);

// app.use(helmet());
// app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin"}))
// app.use(
//   helmet.hsts({
//     maxAge: 86400,
//     includeSubDomains: true,
//   })
//  )
// app.use(helmet({ noSniff: true}))
app.use(cookieParser());
app.use(passport.initialize());
app.use(morgan("dev"));

app.use("/", authRoute);
app.use("/v1/api", productsRoute);
app.use("/v1/api", usersRoute);
app.use("/v1/api", ordersRoute);
app.use("/v1/api", cartRoute);
app.use("/v1/api", categoriesRoute);
app.use("/v1/api", tagsRoute);
app.use("/v1/api", addressRoute);
app.use("/v1/api", paymentRoute);
app.use("/v1/api", dashboardRoute);
app.use("/v1/api", searchProductsRoute);
app.use("/v1/api", emailsRoute);

app.get("/", (_: Request, res: Response) =>
  res.status(200).json({ message: "Welcome home!" }),
);

interface UserPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
}

// Socket.IO authentication middleware
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(createHttpError(401, "No token provided"));
  }

  jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRET as string,
    (err: VerifyErrors | null, decoded: JwtPayload | string | undefined) => {
      if (err) {
        return next(createHttpError(403, "Invalid or expired token"));
      }
      socket.data.user = decoded as UserPayload;
      next();
    },
  );
});

// Socket.IO connection handler
io.on("connection", (socket: Socket) => {
  const user = socket.data.user as UserPayload;
  console.log(`Socket.IO client connected: ${socket.id} for user: ${user.id}`);

  socket.on("joinPayment", (checkoutRequestId: string) => {
    socket.join(checkoutRequestId);
    console.log(`Client ${socket.id} joined room: ${checkoutRequestId}`);
  });

  socket.on("disconnect", () => {
    console.log(
      `Socket.IO client disconnected: ${socket.id} for user: ${user.id}`,
    );
  });
});

export { io };

(async () => {
  try {
    await prisma.$connect();
    console.log(`Server listening on port ${envalid.PORT || 8000}`);
  } catch (error) {
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();

app.use((_, __, next: NextFunction) => {
  next(createHttpError(404, "Endpoint not found"));
});

app.use((error: any, _: Request, res: Response, __: NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Data validation error",
      details: formatZodError(error),
    });
  }

  if (isHttpError(error)) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
    });
  }

  // For unexpected errors
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});
