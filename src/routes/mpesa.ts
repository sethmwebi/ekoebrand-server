import express from "express";
import {
  initiateMpesaPayment,
  handleMpesaCallback,
} from "../controllers/mpesa"; // Adjust path to your controller

const router = express.Router();

// Expects userId and phoneNumber as URL parameters
router.post("/initiate/:userId/:phoneNumber", initiateMpesaPayment);

// Uses raw middleware to parse the JSON payload directly
router.post("/callback", handleMpesaCallback);

export default router;
