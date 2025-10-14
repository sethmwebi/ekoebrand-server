import { Router } from "express";
import { searchProducts } from "../controllers/search-products";

const router = Router();

// Search products
router.get("/search-products", searchProducts);

export default router;
