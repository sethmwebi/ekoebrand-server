import { RequestHandler } from "express";
import { prisma } from "..";
import createHttpError from "http-errors";

type RawProductRevenue = {
  id: string;
  name: string;
  price: number;
  totalrevenue: number | null;
};

type RawCategoryRevenue = {
  category: string;
  revenue: number | null;
};

type ProcessedProductRevenue = {
  id: string;
  name: string;
  price: number;
  totalRevenue: number;
};

type ProcessedCategoryRevenue = {
  category: string;
  revenue: number;
};

type ProductWithoutStats = {
  id: string;
  name: string;
  price: number;
  stock: number;
  images: string[];
  orderDate: Date;
  quantityOrdered: number;
  categoryName: string;
};

type ProductWithStats = ProductWithoutStats & {
  timesOrdered: number;
};

type OrderWithItems = {
  items: {
    product: {
      id: string;
      name: string;
      price: number;
      stock: number;
      images: string[];
      category?: { name: string } | null;
    } | null;
    quantity: number;
  }[];
  createdAt: Date;
};

type LoaderData = {
  totalOrders: number;
  processingOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
  topRevenueProducts: ProcessedProductRevenue[];
  categoriesRevenue: ProcessedCategoryRevenue[];
  productsWithStats: ProductWithStats[];
};

export const getDashboardData: RequestHandler = async (req, res, next) => {
  try {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      processingOrders,
      rawRevenueProducts,
      rawCategoryRevenue,
      lastFiveOrders,
      productOrderCounts,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { status: "PENDING" },
      }),
      prisma.order.count({
        where: { status: "DELIVERED" },
      }),
      prisma.order.count({
        where: { status: "PROCESSING" },
      }),
      prisma.$queryRaw<RawProductRevenue[]>`
        SELECT 
          p.id, 
          p.name, 
          p.price, 
          COALESCE(SUM(p.price * oi.quantity), 0) as totalrevenue 
        FROM "Product" p 
        LEFT JOIN "OrderItem" oi ON p.id = oi."productId" 
        LEFT JOIN "Order" o ON oi."orderId" = o.id
        WHERE o.status = 'COMPLETED' OR o.status IS NULL
        GROUP BY p.id, p.name, p.price
        ORDER BY totalrevenue DESC 
        LIMIT 4
      `,
      prisma.$queryRaw<RawCategoryRevenue[]>`
        SELECT 
          c.name as category,
          COALESCE(SUM(oi.quantity * p.price), 0) as revenue
        FROM "Category" c
        LEFT JOIN "Product" p ON c.id = p."categoryId"
        LEFT JOIN "OrderItem" oi ON p.id = oi."productId"
        LEFT JOIN "Order" o ON oi."orderId" = o.id
        WHERE o.status = 'COMPLETED' OR o.status IS NULL
        GROUP BY c.id, c.name
        ORDER BY revenue DESC
      `,
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  images: true,
                  category: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Fetch order counts for products in a single query
      prisma.$queryRaw<Array<{ productId: string; orderCount: number }>>`
        SELECT 
          oi."productId" as "productId", 
          COUNT(oi.id) as "orderCount"
        FROM "OrderItem" oi
        GROUP BY oi."productId"
      `,
    ]);

    const topRevenueProducts: ProcessedProductRevenue[] =
      rawRevenueProducts.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price) / 100, // Convert price to dollars
        totalRevenue: Number(product.totalrevenue ?? 0) / 100, // Convert to dollars, handle null
      }));

    const categoriesRevenue: ProcessedCategoryRevenue[] =
      rawCategoryRevenue.map((item) => ({
        category: item.category,
        revenue: Number(item.revenue ?? 0) / 100, // Convert to dollars, handle null
      }));

    // Aggregate products by id
    const productMap = new Map<string, ProductWithoutStats>();
    lastFiveOrders.forEach((order: OrderWithItems) => {
      order.items
        .filter(
          (
            item,
          ): item is {
            product: NonNullable<OrderWithItems["items"][number]["product"]>;
            quantity: number;
          } => item.product != null,
        )
        .forEach((item) => {
          const productId = item.product.id;
          const existing = productMap.get(productId);
          if (existing) {
            existing.quantityOrdered += item.quantity;
            if (order.createdAt > existing.orderDate) {
              existing.orderDate = order.createdAt;
            }
          } else {
            productMap.set(productId, {
              id: productId,
              name: item.product.name,
              price: Number(item.product.price) / 100, // Convert price to dollars
              stock: item.product.stock,
              images: item.product.images,
              orderDate: order.createdAt,
              quantityOrdered: item.quantity,
              categoryName: item.product.category?.name ?? "Uncategorized",
            });
          }
        });
    });

    const products = Array.from(productMap.values());

    // Map order counts to products
    const productOrderCountMap = new Map<string, number>(
      productOrderCounts.map((item) => [
        item.productId,
        Number(item.orderCount),
      ]),
    );

    const productsWithStats: ProductWithStats[] = products.map((product) => ({
      ...product,
      timesOrdered: productOrderCountMap.get(product.id) ?? 0,
    }));

    const response: LoaderData = {
      totalOrders,
      processingOrders,
      pendingOrders,
      deliveredOrders,
      topRevenueProducts,
      categoriesRevenue,
      productsWithStats: productsWithStats.slice(0, 5),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error); // Log error for debugging
    next(
      createHttpError(
        500,
        "Internal server error while fetching dashboard data",
      ),
    );
  }
};
