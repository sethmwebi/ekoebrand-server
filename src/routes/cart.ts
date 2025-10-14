import { Router } from "express";
import {
  getCart,
  addToCart,
  removeFromCart,
  changeQuantity,
  clearCart,
} from "../controllers/cart"; // Adjust path to your controller file

const router = Router();

// Get user's cart
router.get("/cart/:userId", getCart);

// Add item to cart
router.post("/cart/:userId/items", addToCart);

// Remove item from cart
router.delete("/cart/:userId/items/:productId", removeFromCart);

// Update item quantity in cart
router.put("/cart/:userId/items/:productId", changeQuantity);

// Clear entire cart
router.delete("/cart/:userId", clearCart);

export default router;
