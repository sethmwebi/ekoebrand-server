import { Router } from "express";
import * as ProductsController from "../controllers/products";

const productsRouter: Router = Router();

productsRouter.get("/products", ProductsController.getAllProducts);
productsRouter.get(
  "/products/most-expensive-price",
  ProductsController.getMostExpensiveProductPrice,
);
productsRouter.get("/products/:id", ProductsController.getProductById);
productsRouter.post("/product", ProductsController.createProduct);
productsRouter.put("/product/:id", ProductsController.updateProduct);
productsRouter.delete("/product/:id", ProductsController.deleteProduct);

export default productsRouter;
