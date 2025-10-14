import { RequestHandler } from "express";
import { prisma } from "..";
import { ProductSearchSchema } from "../schemas/ProductSearchSchema";

// Search products by name
export const searchProducts: RequestHandler = async (req, res, next) => {
  try {
    // Validate and parse query parameters
    const { query, page, pageSize } = ProductSearchSchema.parse(req.query);

    // Build the where clause for filtering
    const where: any = {};

    // Search by name only
    if (query) {
      where.name = { contains: query, mode: "insensitive" };
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Fetch products with the applied filters and pagination
    const products = await prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        reviews: true, // Include reviews to calculate average rating
      },
    });

    // Get the total count for pagination
    const totalCount = await prisma.product.count({ where });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      products,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};
