import type { RequestHandler } from "express";
import createHttpError from "http-errors";
import { prisma } from "..";
import {
  UserSchema,
  UpdateUserSchema,
  EmailSchema,
} from "../schemas/UserSchema";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import formidable from "formidable";
import { randomUUID } from "crypto";
import fs from "fs";
import bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma_client";
import {
  CreateAddressSchema,
  UpdateAddressSchema,
} from "../schemas/AddressSchema";

// Password hashing configuration

const SALT_ROUNDS = 10;

// AWS S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
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

// Helper function to hash passwords
async function hashPassword(password: string | undefined): Promise<string> {
  if (!password) {
    throw new Error("Password cannot be empty");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export const getAllUsers: RequestHandler = async (req, res, next) => {
  try {
    const { role, search } = req.query;

    const whereClause = {
      AND: [
        role ? { role: role as "USER" | "ADMIN" | "SUPERADMIN" } : {},
        search
          ? {
              OR: [
                { name: { contains: search as string, mode: "insensitive" } },
                { email: { contains: search as string, mode: "insensitive" } },
              ],
            }
          : {},
      ].filter(
        (condition) => Object.keys(condition).length > 0,
      ) as Prisma.UserWhereInput,
    };

    const users = await prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        mobileNumber: true,
        image: true,
        role: true,
        createdAt: true,
        address: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

export const getUserById: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        address: true,
        orders: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            totalPrice: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      throw createHttpError(404, "User not found!");
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// Get current user data
export const getMe: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw createHttpError(401, "User not authenticated");
    const userId = (req.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mobileNumber: true,
        image: true,
        accounts: {
          select: {
            type: true,
          },
        },
      },
    });
    if (!user) throw createHttpError(404, "User not found");
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const createUser: RequestHandler = async (req, res, next) => {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
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

    // Validate and parse user data
    const userData = UserSchema.parse({
      name: normalizeField(fields.name),
      email: normalizeField(fields.email),
      mobileNumber: fields.mobileNumber
        ? normalizeField(fields.mobileNumber)
        : undefined,
      password: normalizeField(fields.password),
      role: fields.role
        ? (normalizeField(fields.role) as "USER" | "ADMIN" | "SUPERADMIN")
        : "USER",
    });

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw createHttpError(409, "Email already in use");
    }

    // Hash the password
    const hashedPassword = await hashPassword(userData.password);

    // Process image upload if exists
    let imageUrl: string | undefined;
    if (files.image) {
      const file = Array.isArray(files.image) ? files.image[0] : files.image;
      try {
        const fileName = `users/${randomUUID()}-${file.originalFilename}`;
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
        imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      } catch (uploadError) {
        console.error("Failed to upload image:", uploadError);
        throw createHttpError(500, "Failed to upload user image");
      } finally {
        await fs.promises.unlink(file.filepath).catch(() => {});
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        mobileNumber: userData.mobileNumber,
        password: hashedPassword,
        image: imageUrl,
        role: userData.role,
      },
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      image: user.image,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    // Get the authenticated users's ID
    if (!req.user) throw createHttpError(401, "User not authenticated");
    const userId = (req.user as { id: string }).id;

    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024,
      filter: ({ mimetype }) => !!mimetype?.includes("image"),
    });

    const [fields, files] = await new Promise<
      [fields: formidable.Fields, files: formidable.Files]
    >((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    // Find the user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw createHttpError(404, "User not found!");
    }

    // Parse and validate the request body
    const userData = UpdateUserSchema.parse({
      name: fields.name ? normalizeField(fields.name) : undefined,
      email: fields.email ? normalizeField(fields.email) : undefined,
      mobileNumber: fields.mobileNumber
        ? normalizeField(fields.mobileNumber)
        : undefined,
      password: fields.password ? normalizeField(fields.password) : undefined,
      role: fields.role
        ? (normalizeField(fields.role) as "USER" | "ADMIN" | "SUPERADMIN")
        : undefined,
    });

    // Check if new email is already in use
    if (userData.email && userData.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      if (existingUser) {
        throw createHttpError(409, "Email already in use");
      }
    }

    // Hash the password if it's being updated
    let hashedPassword: string | undefined;
    if (userData.password) {
      hashedPassword = await hashPassword(userData.password);
    }

    //Process image upload if exists
    let imageUrl = user.image;
    if (files.image) {
      const file = Array.isArray(files.image) ? files.image[0] : files.image;
      try {
        const fileName = `users/${randomUUID()}-${file.originalFilename}`;
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

        imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      } catch (uploadError) {
        console.error("Failed to upload image: ", uploadError);
        throw createHttpError(500, "Failed to upload user image");
      } finally {
        await fs.promises.unlink(file.filepath).catch(() => {});
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: userData.name,
        email: userData.email,
        mobileNumber: userData.mobileNumber,
        password: hashedPassword,
        image: imageUrl,
        role: userData.role,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    // Get the authenticated user's ID
    if (!req.user) throw createHttpError(401, "User not authenticated");
    const userId = (req.user as { id: string }).id;

    // Find the user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw createHttpError(404, "User not found!");
    }

    // Prevent deletion of the last admin/superadmin
    if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: user.role },
      });
      if (adminCount <= 1) {
        throw createHttpError(
          400,
          `Cannot delete the last ${user.role.toLowerCase()}`,
        );
      }
    }

    await prisma.user.delete({ where: { id: userId } });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
};

export const updateUserAddress: RequestHandler = async (req, res, next) => {
  try {
    // Get the authenticated user's ID
    if (!req.user) throw createHttpError(401, "User not authenticated");
    const userId = (req.user as { id: string }).id;

    // Validate with update schema
    const updateData = UpdateAddressSchema.parse(req.body);

    const existingAddress = await prisma.address.findFirst({
      where: { userId },
    });

    let result;
    if (existingAddress) {
      result = await prisma.address.update({
        where: { id: existingAddress.id }, // Use the address ID instead of userId
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new address
      const createData = CreateAddressSchema.parse({
        ...updateData,
        country: updateData.country || "Kenya",
      });
      result = await prisma.address.create({
        data: {
          ...createData,
          user: { connect: { id: userId } },
        },
      });
    }

    const { userId: _, ...responseData } = result;
    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    next(error);
  }
};

export const checkEmailAvailability: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const validation = EmailSchema.safeParse(req.body);
    if (!validation.success) {
      throw createHttpError(400, validation.error.errors[0].message);
    }

    const { email } = validation.data;

    const userExists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (userExists) {
      return res.status(200).json({
        exists: true,
        message: "Email is not available",
      });
    }

    return res.status(200).json({
      exists: false,
      message: "Email is available",
    });
  } catch (error) {
    next(error);
  }
};
