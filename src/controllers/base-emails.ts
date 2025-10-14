import { RequestHandler } from "express";
import { prisma } from "..";
import {
  EmailQuerySchema,
  EmailCreateSchema,
  EmailUpdateSchema,
} from "../schemas/EmailSchema";
import { resend } from "../utils/resend-client";
import { EmailStatus } from "../../generated/prisma_client";

// Create a new email and send it via Resend
export const createEmail: RequestHandler = async (req, res, next) => {
  try {
    const emailData = EmailCreateSchema.parse(req.body);

    // Send email via Resend first
    let resendData: any = null;
    let resendError: any = null;
    let emailStatus: EmailStatus = EmailStatus.PENDING;

    try {
      const { data, error } = await resend.emails.send({
        from: "Your Store <sethmwebi27@gmail.com>",
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.content,
      });

      if (error) {
        resendError = error;
        emailStatus = EmailStatus.FAILED;
      } else {
        resendData = data;
        emailStatus = "SENT";
      }
    } catch (error) {
      resendError = error;
      emailStatus = "FAILED";
    }

    // Create email record in database
    const email = await prisma.email.create({
      data: {
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        content: emailData.content,
        status: emailStatus,
        userId: emailData.userId,
        orderId: emailData.orderId,
        scheduledAt: emailData.scheduledAt,
        error: resendError?.message || null,
        sentAt: emailStatus == "SENT" ? new Date() : null,
        resendId: resendData?.id || null,
      },
    });

    if (resendError) {
      return res.status(500).json({
        message: "Email created but failed to send",
        error: resendError.message,
        email,
      });
    }

    res.status(201).json({
      message: "Email created and sent successfully",
      email,
      resendId: resendData?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Get all emails with filtering and pagination
export const getEmails: RequestHandler = async (req, res, next) => {
  try {
    const {
      status,
      to,
      userId,
      orderId,
      page = 1,
      pageSize = 20,
    } = EmailQuerySchema.parse(req.query);

    // Build the where clause for filtering
    const where: any = {};

    if (status) where.status = status;
    if (to) where.to = { contains: to, mode: "insensitive" };
    if (userId) where.userId = userId;
    if (orderId) where.orderId = orderId;

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Fetch emails with applied filters and pagination
    const emails = await prisma.email.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get the total count for pagination
    const totalCount = await prisma.email.count({ where });

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      emails,
      paginaton: {
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

// Get email by ID
export const getEmailById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const email = await prisma.email.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            status: true,
            totalPrice: true,
          },
        },
      },
    });

    if (!email) {
      return res.status(404).json({ message: "Email not found" });
    }
    res.status(200).json(email);
  } catch (error) {
    next(error);
  }
};

// Update email status and tracking
export const updateEmail: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = EmailUpdateSchema.parse(req.body);
    const email = await prisma.email.update({
      where: { id },
      data: {
        status: updateData.status,
        retryCount: updateData.retryCount,
        error: updateData.error,
        sentAt:
          updateData.status === "SENT" || updateData.status === "DELIVERED"
            ? new Date()
            : undefined,
      },
    });

    res.status(200).json({
      message: "Email updated successfully",
      email,
    });
  } catch (error) {
    next(error);
  }
};

// Retry failed email delivery with Resend
export const retryEmail: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const email = await prisma.email.findUnique({
      where: { id },
    });
    if (!email) {
      return res.status(404).json({ message: "Email not found" });
    }

    if (email.status !== "FAILED" && email.status !== "BOUNCED") {
      return res.status(400).json({
        message: "Only failed or bounced emails can be retried",
      });
    }

    // Attempt to resend via Resend
    let resendData: any = null;
    let resendError: any = null;
    let newStatus: EmailStatus = "RETRYING";

    try {
      const { data, error } = await resend.emails.send({
        from: "Your store <sethmwebi27@gmail.com>",
        to: email.to,
        subject: email.subject,
        html: email.content,
      });

      if (error) {
        resendError = error;
        newStatus = "FAILED";
      } else {
        resendData = data;
        newStatus = "SENT";
      }
    } catch (error) {
      resendError = error;
      newStatus = "FAILED";
    }

    // Update eamil record
    const updatedEmail = await prisma.email.update({
      where: { id },
      data: {
        status: newStatus,
        retryCount: { increment: 1 },
        error: resendError?.message || null,
        sentAt: newStatus === "SENT" ? new Date() : undefined,
        resendId: resendData?.id || email.resendId,
      },
    });

    if (resendError) {
      return res.status(500).json({
        message: "Email retry failed",
        error: resendError.message,
        email: updatedEmail,
      });
    }

    res.status(200).json({
      message: "Email resent successfully",
      email: updatedEmail,
      resendId: resendData?.id,
    });
  } catch (error) {
    next(error);
  }
};

// Get email statistics
export const getEmailStats: RequestHandler = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const stats = await prisma.email.groupBy({
      by: ["status"],
      where,
      _count: {
        status: true,
      },
    });

    const totalEmails = await prisma.email.count({ where });
    const failedEmails = await prisma.email.count({
      where: { ...where, status: { in: ["FAILED", "BOUNCED"] } },
    });

    const successRate =
      totalEmails > 0 ? ((totalEmails - failedEmails) / totalEmails) * 100 : 0;
    res.status(200).json({
      stats,
      totalEmails,
      failedEmails,
      successRate: successRate.toFixed(2),
    });
  } catch (error) {
    next(error);
  }
};

// Get emails by user ID
export const getUserEmails: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, pageSize = 20 } = EmailQuerySchema.parse(req.query);

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const emails = await prisma.email.findMany({
      where: { userId },
      skip,
      take,
      include: {
        order: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalCount = await prisma.email.count({ where: { userId } });
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      emails,
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

// Get emails by order ID
export const getOrderEmails: RequestHandler = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { page = 1, pageSize = 20 } = EmailQuerySchema.parse(req.query);

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const emails = await prisma.email.findMany({
      where: { orderId },
      skip,
      take,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalCount = await prisma.email.count({ where: { orderId } });
    const totalPages = Math.ceil(totalCount / pageSize);

    res.status(200).json({
      emails,
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

// Delete email (admin only)
export const deleteEmail: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.email.delete({
      where: { id },
    });

    res.status(200).json({ message: "Email deleted successfully" });
  } catch (error) {
    next(error);
  }
};
