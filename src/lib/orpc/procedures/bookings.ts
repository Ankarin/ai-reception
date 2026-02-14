import { os } from "@orpc/server";
import * as z from "zod";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import { authMiddleware, requireOrgMiddleware } from "../middleware";

export const getBookings = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().min(1).optional().default(1),
      pageSize: z.number().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const conditions: any[] = [eq(bookings.organizationId, input.orgId)];
    if (input.status) conditions.push(eq(bookings.status, input.status));
    if (input.dateFrom) conditions.push(gte(bookings.date, input.dateFrom));
    if (input.dateTo) conditions.push(lte(bookings.date, input.dateTo));

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(bookings)
      .where(whereClause);

    const total = totalResult?.count || 0;
    const offset = (input.page - 1) * input.pageSize;

    const results = await db.query.bookings.findMany({
      where: whereClause,
      with: { service: true },
      orderBy: [desc(bookings.date)],
      limit: input.pageSize,
      offset,
    });

    return {
      bookings: results,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  });

export const createBooking = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      serviceId: z.string().uuid().optional(),
      patientName: z.string().min(1),
      patientPhone: z.string().optional(),
      patientEmail: z.string().optional(),
      date: z.string(),
      time: z.string(),
      notes: z.string().optional(),
      source: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const [newBooking] = await db
      .insert(bookings)
      .values({
        organizationId: input.orgId,
        serviceId: input.serviceId || null,
        patientName: input.patientName,
        patientPhone: input.patientPhone || null,
        patientEmail: input.patientEmail || null,
        date: input.date,
        time: input.time,
        notes: input.notes || null,
        source: input.source || "dashboard",
      })
      .returning();

    return newBooking;
  });

export const updateBooking = os
  .use(authMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      orgId: z.string(),
      id: z.string().uuid(),
      status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.orgId !== context.orgId) {
      throw new Error("Unauthorized: You don't have access to this organization");
    }

    const { orgId, id, ...updateData } = input;
    const [updated] = await db
      .update(bookings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(bookings.id, id), eq(bookings.organizationId, orgId)))
      .returning();

    if (!updated) throw new Error("Booking not found");
    return updated;
  });
