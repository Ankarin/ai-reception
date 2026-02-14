import { tool } from "ai";
import * as z from "zod";
import { db } from "@/db";
import { services, bookings } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type ChatTools = Record<string, any>;

export function createChatTools(
  chatId: string,
  organizationId: string,
  schoolId?: number,
): ChatTools {
  return {
    listServices: tool({
      description:
        "List all available dental services with prices and durations. Use when a patient asks about services, treatments, pricing, or what the clinic offers.",
      parameters: z.object({}),
      execute: async () => {
        const allServices = await db
          .select()
          .from(services)
          .where(
            and(
              eq(services.organizationId, organizationId),
              eq(services.isActive, 1),
            ),
          );

        return allServices.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          price: `${(s.price / 100).toFixed(0)} UAH`,
          duration: `${s.duration} minutes`,
        }));
      },
    }),

    checkAvailability: tool({
      description:
        "Check available appointment time slots for a given date. Use when a patient wants to book or asks about availability. Working hours: Mon–Fri 09:00–19:00, Sat 10:00–16:00, Sun — closed.",
      parameters: z.object({
        date: z.string().describe("The date to check in YYYY-MM-DD format"),
      }),
      execute: async ({ date }) => {
        const dayOfWeek = new Date(date).getDay(); // 0=Sun, 6=Sat

        if (dayOfWeek === 0) {
          return {
            date,
            closed: true,
            message: "Клініка не працює у неділю. Будь ласка, оберіть інший день.",
            availableSlots: [],
            totalSlots: 0,
            bookedSlots: 0,
          };
        }

        const startHour = dayOfWeek === 6 ? 10 : 9;
        const endHour = dayOfWeek === 6 ? 16 : 19;

        const existingBookings = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.date, date),
              eq(bookings.status, "confirmed"),
            ),
          );

        const bookedTimes = new Set(existingBookings.map((b) => b.time));

        const allSlots: string[] = [];
        for (let hour = startHour; hour < endHour; hour++) {
          for (const min of ["00", "30"]) {
            allSlots.push(`${hour.toString().padStart(2, "0")}:${min}`);
          }
        }

        return {
          date,
          dayOfWeek: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "Пʼятниця", "Субота"][dayOfWeek],
          workingHours: `${startHour.toString().padStart(2, "0")}:00–${endHour.toString().padStart(2, "0")}:00`,
          availableSlots: allSlots.filter((s) => !bookedTimes.has(s)),
          totalSlots: allSlots.length,
          bookedSlots: bookedTimes.size,
        };
      },
    }),

    createBooking: tool({
      description:
        "Create a new appointment booking. Use when a patient confirms they want to book. You MUST have the patient's name, date, and time before calling this.",
      parameters: z.object({
        patientName: z.string().describe("Full name of the patient"),
        patientPhone: z.string().optional().describe("Patient phone number"),
        date: z.string().describe("Appointment date in YYYY-MM-DD format"),
        time: z
          .string()
          .describe("Appointment time in HH:MM format (e.g., '09:00')"),
        serviceId: z.string().optional().describe("ID of the selected service"),
        notes: z
          .string()
          .optional()
          .describe("Any additional notes about the appointment"),
      }),
      execute: async ({
        patientName,
        patientPhone,
        date,
        time,
        serviceId,
        notes,
      }) => {
        const existing = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.date, date),
              eq(bookings.time, time),
              eq(bookings.status, "confirmed"),
            ),
          );

        if (existing.length > 0) {
          return {
            success: false,
            message:
              "This time slot is no longer available. Please choose another time.",
          };
        }

        const [newBooking] = await db
          .insert(bookings)
          .values({
            organizationId,
            serviceId: serviceId || null,
            patientName,
            patientPhone: patientPhone || null,
            date,
            time,
            notes: notes || null,
            source: "chat",
            chatId,
          })
          .returning();

        let serviceName = null;
        if (serviceId) {
          const [svc] = await db
            .select()
            .from(services)
            .where(eq(services.id, serviceId));
          serviceName = svc?.name;
        }

        return {
          success: true,
          bookingId: newBooking.id,
          message: `Booking confirmed for ${patientName} on ${date} at ${time}${serviceName ? ` for ${serviceName}` : ""}.`,
        };
      },
    }),

    lookupBooking: tool({
      description:
        "Look up existing bookings by patient name or phone number. Use when a patient wants to check, cancel, or reschedule an appointment.",
      parameters: z.object({
        patientName: z
          .string()
          .optional()
          .describe("Patient name to search for"),
        patientPhone: z
          .string()
          .optional()
          .describe("Patient phone to search for"),
      }),
      execute: async ({ patientName, patientPhone }) => {
        let results: any[] = [];

        if (patientPhone) {
          results = await db.query.bookings.findMany({
            where: and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.patientPhone, patientPhone),
            ),
            with: { service: true },
            orderBy: (bookings, { desc }) => [desc(bookings.date)],
            limit: 10,
          });
        }

        if (results.length === 0 && patientName) {
          results = await db.query.bookings.findMany({
            where: and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.patientName, patientName),
            ),
            with: { service: true },
            orderBy: (bookings, { desc }) => [desc(bookings.date)],
            limit: 10,
          });
        }

        return results.map((b) => ({
          id: b.id,
          patientName: b.patientName,
          date: b.date,
          time: b.time,
          status: b.status,
          service: b.service?.name || "General",
          notes: b.notes,
        }));
      },
    }),
  };
}
