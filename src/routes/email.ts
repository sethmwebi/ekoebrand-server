// routes/emailRoutes.ts
import { Router } from "express";
import {
  sendOrderConfirmation,
  sendShippingNotification,
  sendPasswordReset,
  sendAccountVerification,
  sendPromotionalEmail,
  sendAbandonedCartReminder,
} from "../controllers/email"; // Adjust path to your controller file
import {
  createEmail,
  getEmails,
  getEmailById,
  updateEmail,
  retryEmail,
  getEmailStats,
  getUserEmails,
  getOrderEmails,
  deleteEmail,
} from "../controllers/base-emails";
import verifyAdmin from "../middleware/verify-admin";

const router = Router();
router.use(verifyAdmin);

// Base email routes
router.post("/emails", createEmail);
router.get("/emails", getEmails);
router.get("/emails/stats", getEmailStats);
router.get("/emails/:id", getEmailById);
router.put("/emails/:id", updateEmail);
router.post("/emails/:id/retry", retryEmail);
router.get("/users/:userId/emails", getUserEmails);
router.get("/orders/:orderId/emails", getOrderEmails);
router.delete("/emails/:id", deleteEmail);

// Specific email type routes
router.post("/emails/order-confirmation", sendOrderConfirmation);
router.post("/emails/shipping-notification", sendShippingNotification);
router.post("/emails/password-reset", sendPasswordReset);
router.post("/emails/account-verification", sendAccountVerification);
router.post("/emails/promotional", sendPromotionalEmail);
router.post("/emails/abandoned-cart", sendAbandonedCartReminder);

export default router;
