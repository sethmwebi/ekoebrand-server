import fs from "fs";
import type { RequestHandler } from "express";
import createHttpError from "http-errors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import formidable from "formidable";
import { randomUUID } from "crypto";
import path from "path";
import { prisma } from "..";
import { ProductSchema, UpdateProductSchema } from "../schemas/ProductSchema";
import { FiltersSchema } from "../schemas/ProductFilterSchema";
import { Prisma } from "../../generated/prisma_client";
import { generateUniqueSlug } from "../utils/slugify";

export const getAllProducts: RequestHandler = async (req, res, next) => {
  try {
    const filtersInput = FiltersSchema.parse(req.query);

    const { lowerBound, upperBound, categories, tags, sort } = filtersInput;

    const whereClause = {
      AND: [
        lowerBound !== undefined || upperBound !== undefined
          ? { price: { gte: lowerBound || 0, lte: upperBound || Infinity } }
          : {},
        categories
          ? {
              categoryId: {
                in: categories.split(",").map((cat) => cat.trim()),
              },
            }
          : {},
        tags
          ? {
              tags: {
                some: {
                  tagId: {
                    in: tags.split(",").map((tag) => tag.trim()),
                  },
                },
              },
            }
          : {},
      ].filter((condition) => Object.keys(condition).length > 0),
    };

    let orderByClause: Prisma.ProductOrderByWithRelationInput | undefined;
    if (sort === "asc" || sort === "desc") {
      orderByClause = { price: sort };
    } else if (sort === "newest") {
      orderByClause = { createdAt: "desc" };
    } else {
      orderByClause = { createdAt: "asc" };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: orderByClause ? [orderByClause] : undefined,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

export const getProductById: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw createHttpError(404, "Product not found!");
    }
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

export const getMostExpensiveProductPrice: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const mostExpensiveProduct = await prisma.product.findFirstOrThrow({
      where: {
        stock: { gt: 0 },
      },
      orderBy: {
        price: "desc",
      },
      select: {
        price: true,
      },
    });

    res.status(200).json(mostExpensiveProduct.price / 100);
  } catch (error) {
    next(error);
  }
};

// AWS S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!, // Fixed: Use AWS_ACCESS_KEY_ID
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

// Helper function to normalize formidable fields
function normalizeField(field: string | string[] | undefined): string {
  if (typeof field === "string") {
    return field;
  }
  if (Array.isArray(field) && field.length > 0) {
    return field[0];
  }
  throw new Error("Field is undefined or empty");
}

export const createProduct: RequestHandler = async (req, res, next) => {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    filter: ({ mimetype }) => !!mimetype?.includes("image"),
  });

  try {
    const [fields, files] = await new Promise<
      [fields: formidable.Fields, files: formidable.Files]
    >((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Validate and parse product data first
    const productData = ProductSchema.parse({
      name: normalizeField(fields.name),
      description: normalizeField(fields.description),
      price: parseFloat(normalizeField(fields.price)),
      stock: parseInt(normalizeField(fields.stock)),
      categoryId: fields.categoryId
        ? normalizeField(fields.categoryId)
        : undefined,
      tagIds: fields.tagIds
        ? JSON.parse(normalizeField(fields.tagIds))
        : undefined,
    });

    // Generate unique slug
    const slug = await generateUniqueSlug(productData.name);

    // Validate tags exist before processing images
    if (productData.tagIds?.length) {
      const existingTags = await prisma.tag.count({
        where: { id: { in: productData.tagIds } },
      });
      if (existingTags !== productData.tagIds.length) {
        throw createHttpError(400, "One or more tags don't exist");
      }
    }

    // Process image uploads
    const imageFiles = Array.isArray(files.images)
      ? files.images
      : files.images
        ? [files.images]
        : [];

    if (imageFiles.length === 0) {
      throw createHttpError(400, "At least one product image is required");
    }

    // Upload all images first
    const imageUrls = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const fileExtension = path.extname(file.originalFilename || ".jpg");
          const fileName = `products/${randomUUID()}-${file.originalFilename}${fileExtension}`;
          const fileContent = await fs.promises.readFile(file.filepath);

          await s3Client.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileName,
              Body: fileContent,
              ContentType: file.mimetype || "image/jpeg",
              ACL: "public-read",
            }),
          );

          return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        } catch (uploadError) {
          console.error("Failed to upload image:", uploadError);
          throw createHttpError(500, "Failed to upload product images");
        } finally {
          await fs.promises.unlink(file.filepath).catch(() => {});
        }
      }),
    );

    // Only create product after all uploads succeed
    const product = await prisma.product.create({
      data: {
        name: productData.name,
        slug,
        description: productData.description,
        price: Math.round(productData.price * 100), // Store in cents
        stock: productData.stock,
        categoryId: productData.categoryId,
        images: imageUrls,
        tags: productData.tagIds?.length
          ? {
              create: productData.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: { select: { name: true } },
        tags: { select: { tag: true } },
      },
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Product creation error:", error);
    next(error);
  }
};

export const updateProduct: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
    filter: ({ mimetype }) => !!mimetype?.includes("image"),
  });

  try {
    const [fields, files] = await new Promise<
      [fields: formidable.Fields, files: formidable.Files]
    >((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Validate and parse product data
    const productData = UpdateProductSchema.parse({
      name: normalizeField(fields.name),
      description: normalizeField(fields.description),
      price: parseFloat(normalizeField(fields.price)) * 100,
      stock: parseInt(normalizeField(fields.stock)),
      categoryId: fields.categoryId
        ? normalizeField(fields.categoryId)
        : undefined,
      tagIds: fields.tagIds
        ? JSON.parse(normalizeField(fields.tagIds))
        : undefined,
    });

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw createHttpError(404, "Product not found!");
    }

    // Generate new slug only if name changed
    let slug = product.slug;
    if (productData.name && productData.name !== product.name) {
      slug = await generateUniqueSlug(productData.name, product.id);
    }

    // Validate tags exist
    if (productData.tagIds?.length) {
      const existingTags = await prisma.tag.count({
        where: { id: { in: productData.tagIds } },
      });
      if (existingTags !== productData.tagIds.length) {
        throw createHttpError(400, "Atleast one tag required!");
      }
    }

    // Process image uploads if any
    let imageUrls = product.images;
    const imageFiles = Array.isArray(files.images)
      ? files.images
      : files.images
        ? [files.images]
        : [];

    if (imageFiles.length > 0) {
      const newImageUrls = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const fileExtension = path.extname(file.originalFilename || ".jpg");
            const fileName = `products/${randomUUID()}-${file.originalFilename}${fileExtension}`;
            const fileContent = await fs.promises.readFile(file.filepath);
            await s3Client.send(
              new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: fileContent,
                ContentType: file.mimetype || "image/jpeg",
                ACL: "public-read",
              }),
            );
            return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
          } catch (uploadError) {
            console.log("Failed to upload image:", uploadError);
            throw createHttpError(500, "Failed to upload product images");
          } finally {
            await fs.promises.unlink(file.filepath).catch(() => {});
          }
        }),
      );
      imageUrls = [...product.images, ...newImageUrls];
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: productData.name,
        slug,
        description: productData.description,
        price: productData.price,
        stock: productData.stock,
        categoryId: productData.categoryId,
        images: imageUrls,
        tags: productData.tagIds
          ? {
              deleteMany: {},
              create: productData.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: { select: { name: true } },
        tags: { include: { tag: true } },
      },
    });

    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct: RequestHandler = async (req, res, next) => {
  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw createHttpError(404, "Product not found!");
    }

    await prisma.product.delete({ where: { id } });
    res.status(204).json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};
