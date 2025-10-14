import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import axios, { AxiosError } from "axios";
import { prisma, io } from "..";

// Environment variables
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY!;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE!;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY!;

// Type definitions
interface MpesaTokenResponse {
  access_token: string;
}

interface MpesaStkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: string;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
  InitiatorName: string;
  InitiatorPassword: string;
}

interface MpesaStkPushResponse {
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

interface MpesaCallbackBody {
  Body: {
    stkCallback: {
      CheckoutRequestID: string;
      ResultCode: string;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: { Name: string; Value: string }[];
      };
    };
  };
}

interface PaymentStatusPayload {
  checkoutRequestId: string;
  status: "COMPLETED" | "FAILED";
  message: string;
}

// Utility functions
const getNgrokPublicUrl = async (): Promise<string> => {
  try {
    const response = await axios.get<{
      tunnels: { proto: string; public_url: string }[];
    }>("http://ngrok:4040/api/tunnels");
    const publicUrl = response.data.tunnels.find(
      (tunnel) => tunnel.proto === "https",
    )?.public_url;
    if (!publicUrl) {
      throw createHttpError(500, "Ngrok public URL not found"); // Updated to use createHttpError
    }
    return publicUrl;
  } catch (error: unknown) {
    console.error(
      "Failed to fetch Ngrok URL:",
      (error as Error).message || error,
    );
    throw createHttpError(500, "Failed to fetch Ngrok public URL");
  }
};

const getMpesaToken = async (): Promise<string> => {
  try {
    const auth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`,
    ).toString("base64");
    const response = await axios.get<MpesaTokenResponse>(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data.access_token;
  } catch (error: unknown) {
    console.error(
      "M-Pesa token generation failed:",
      (error as Error).message || error,
    );
    throw createHttpError(500, "Failed to generate M-Pesa OAuth token");
  }
};

// Controllers
export const initiateMpesaPayment = async (
  req: Request<{ userId: string; phoneNumber: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, phoneNumber } = req.params;

    if (!userId || !phoneNumber) {
      throw createHttpError(400, "User ID and phone number are required");
    }

    console.log("MPESA_SHORTCODE:", MPESA_SHORTCODE);
    console.log("MPESA_PASSKEY:", MPESA_PASSKEY);

    const cartItems = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      throw createHttpError(400, "Cart is empty");
    }

    const totalAmount = Math.round(
      cartItems.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0,
      ) / 100,
    );

    const token = await getMpesaToken();
    const formattedPhone = phoneNumber.startsWith("0")
      ? `254${phoneNumber.slice(1)}`
      : phoneNumber;
    const ngrokPublicUrl = await getNgrokPublicUrl();
    const MPESA_CALLBACK_URL = `${ngrokPublicUrl}/v1/api/mpesa/callback`;
    console.log("Callback URL:", MPESA_CALLBACK_URL);

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`,
    ).toString("base64");

    const response = await axios.post<MpesaStkPushResponse>(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: totalAmount.toString(),
        PartyA: formattedPhone,
        PartyB: MPESA_SHORTCODE,
        PhoneNumber: formattedPhone,
        CallBackURL: MPESA_CALLBACK_URL,
        AccountReference: `Order_${userId}_${Date.now()}`,
        TransactionDesc: "Payment for order",
        InitiatorName: process.env.MPESA_INITIATOR_NAME || "testapi",
        InitiatorPassword:
          process.env.MPESA_INITIATOR_PASSWORD || "Safaricom123!",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const { CheckoutRequestID } = response.data;
    console.log("STK Push Response:", response.data);

    await prisma.payment.create({
      data: {
        orderId: null,
        amount: totalAmount,
        currency: "KES",
        status: "PENDING",
        checkoutRequestId: CheckoutRequestID,
      },
    });

    res.status(200).json({
      message: "M-Pesa payment initiated",
      checkoutRequestId: CheckoutRequestID,
    });
  } catch (error: unknown) {
    console.error("Full error in initiateMpesaPayment:", error);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        errorMessage?: string;
        error?: string;
      }>;
      console.error("M-Pesa API Response:", axiosError.response?.data);
      const errorMessage =
        axiosError.response?.data?.errorMessage ||
        axiosError.response?.data?.error ||
        JSON.stringify(axiosError.response?.data) ||
        "Unknown error";
      return next(createHttpError(500, `M-Pesa API Error: ${errorMessage}`));
    }
    const errorMsg = (error as Error).message || "Internal server error";
    next(createHttpError(500, errorMsg));
  }
};

export const handleMpesaCallback = async (
  req: Request<{}, {}, MpesaCallbackBody>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { Body } = req.body;

    console.log(
      "Raw M-Pesa Callback Payload:",
      JSON.stringify(req.body, null, 2),
    );

    if (!Body || !Body.stkCallback) {
      throw createHttpError(
        400,
        "Invalid callback payload: Missing Body or stkCallback",
      );
    }

    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } =
      stkCallback;
    console.log("Processed Callback:", stkCallback);

    let statusMessage: string;
    let userId: string | undefined;

    if (ResultCode === "0") {
      if (!CallbackMetadata?.Item) {
        throw createHttpError(
          400,
          "Missing callback metadata for successful payment",
        );
      }

      const metadataItems = CallbackMetadata.Item;
      userId = metadataItems
        .find((item) => item.Name === "AccountReference")
        ?.Value.split("_")[1];
      const amountStr = metadataItems.find(
        (item) => item.Name === "Amount",
      )?.Value;
      const amount = amountStr ? parseFloat(amountStr) : undefined;

      if (!userId || !amount) {
        throw createHttpError(
          400,
          "Invalid callback metadata: userId or amount missing",
        );
      }

      const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw createHttpError(400, "No items found in cart");
      }

      const totalPrice =
        cartItems.reduce(
          (sum, item) => sum + item.quantity * item.product.price,
          0,
        ) / 100;

      const definiteUserId = userId as string;

      await prisma.$transaction(async (prisma) => {
        const order = await prisma.order.create({
          data: {
            userId: definiteUserId,
            totalPrice,
            status: "COMPLETED",
            items: {
              create: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            },
          },
        });

        await prisma.payment.update({
          where: { checkoutRequestId: CheckoutRequestID },
          data: {
            orderId: order.id,
            amount,
            status: "COMPLETED",
          },
        });

        await prisma.cartItem.deleteMany({ where: { userId: definiteUserId } });
      });

      statusMessage = "Payment completed successfully!";
      console.log(
        `Payment completed for CheckoutRequestID: ${CheckoutRequestID}`,
      );
    } else {
      await prisma.payment.update({
        where: { checkoutRequestId: CheckoutRequestID },
        data: {
          status: "FAILED",
          failureReason: ResultDesc,
        },
      });
      statusMessage = ResultDesc || "Payment failed. Please try again.";
      console.log(`M-Pesa payment failed: ${ResultDesc}`);
    }

    const payload: PaymentStatusPayload = {
      checkoutRequestId: CheckoutRequestID,
      status: ResultCode === "0" ? "COMPLETED" : "FAILED",
      message: statusMessage,
    };
    console.log(
      `Emitting paymentStatus to room ${CheckoutRequestID}:`,
      payload,
    ); // Added logging
    io.to(CheckoutRequestID).emit("paymentStatus", payload);

    res.status(200).json({ message: "Callback processed" });
  } catch (error: unknown) {
    console.error("Error in handleMpesaCallback:", error);

    const checkoutRequestId = req.body?.Body?.stkCallback?.CheckoutRequestID;
    if (checkoutRequestId) {
      const fallbackPayload: PaymentStatusPayload = {
        checkoutRequestId,
        status: "FAILED",
        message: "An error occurred while processing the payment callback.",
      };
      console.log(
        `Emitting fallback paymentStatus to room ${checkoutRequestId}:`,
        fallbackPayload,
      ); // Added logging
      io.to(checkoutRequestId).emit("paymentStatus", fallbackPayload);
    }

    next(
      createHttpError(
        500,
        (error as Error).message || "Failed to process callback",
      ),
    );
  }
};
