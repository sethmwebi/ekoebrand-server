import { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import { TagSchema, UpdateTagSchema } from "../schemas/TagSchema";

// Get all tags
export const getAllTags: RequestHandler = async (req, res, next) => {
  try {
    const tags = await prisma.tag.findMany();
    res.status(200).json(tags);
  } catch (error) {
    next(error);
  }
};

// Get a single tag by ID
export const getTagById: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      throw createHttpError(404, "Tag not found!");
    }
    res.status(200).json(tag);
  } catch (error) {
    next(error);
  }
};

// Create a new tag
export const createTag: RequestHandler = async (req, res, next) => {
  try {
    const tagData = TagSchema.parse(req.body);
    const tag = await prisma.tag.create({ data: tagData });
    res.status(201).json(tag);
  } catch (error) {
    next(error);
  }
};

// Update an existing tag
export const updateTag: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw createHttpError(404, "Tag not found!");
    }

    const tagBody = UpdateTagSchema.parse(req.body); // Validate request body
    const updatedTag = await prisma.tag.update({
      where: { id },
      data: tagBody,
    });
    res.status(200).json(updatedTag);
  } catch (error) {
    next(error);
  }
};

// Delete a tag
export const deleteTag: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const tag = await prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw createHttpError(404, "Tag not found!");
    }

    await prisma.tag.delete({ where: { id } });
    res.status(204).json({ message: "Tag deleted successfully" });
  } catch (error) {
    next(error);
  }
};
