import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  CategorySchema,
  UpdateCategorySchema,
} from "../schemas/CategorySchema";

// Get all categories
export const getAllCategories: RequestHandler = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
};

// Get a single category by ID
export const getCategoryById: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw createHttpError(404, "Category not found!");
    }
    res.status(200).json(category);
  } catch (error) {
    next(error);
  }
};

// Create a new category
export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const categoryData = CategorySchema.parse(req.body);
    const category = await prisma.category.create({ data: categoryData });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

// Update an existing category
export const updateCategory: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw createHttpError(404, "Category not found!");
    }

    const categoryBody = UpdateCategorySchema.parse(req.body);
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: categoryBody,
    });
    res.status(200).json(updatedCategory);
  } catch (error) {
    next(error);
  }
};

// Delete a category
export const deleteCategory: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw createHttpError(404, "Category not found!");
    }

    await prisma.category.delete({ where: { id } });
    res.status(204).json({ message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
};
