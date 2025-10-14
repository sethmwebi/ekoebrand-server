import { Router } from "express";
import * as CategoriesController from "../controllers/categories";

const categoriesRouter: Router = Router();

// GET /categories - Get all categories
categoriesRouter.get("/categories", CategoriesController.getAllCategories);

// GET /categories/:id - Get a single category by ID
categoriesRouter.get("/categories/:id", CategoriesController.getCategoryById);

// POST /category - Create a new category
categoriesRouter.post("/category", CategoriesController.createCategory);

// PUT /category/:id - Update an existing category
categoriesRouter.put("/category/:id", CategoriesController.updateCategory);

// DELETE /category/:id - Delete a category
categoriesRouter.delete("/category/:id", CategoriesController.deleteCategory);

export default categoriesRouter;
