import { tool } from "ai";
import * as z from "zod";
import { db } from "@/db";
import { services, bookings } from "@/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

export type ChatTools = Record<string, any>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTimeInput(time: string): string {
  const normalized = time.trim();

  if (/^\d{1,2}$/.test(normalized)) {
    const hours = Number.parseInt(normalized, 10);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, "0")}:00`;
    }
  }

  const hourMinuteMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (hourMinuteMatch) {
    const [, hoursRaw, minutes] = hourMinuteMatch;
    const hours = Number.parseInt(hoursRaw, 10);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    }
  }

  return normalized;
}

export function createChatTools(
  chatId: string,
  organizationId: string,
  schoolId?: number,
): ChatTools {
  return {
    listServices: tool({
      description:
        "List all available dental services with prices and durations. Use when a patient asks about services, treatments, pricing, or what the clinic offers.",
      inputSchema: z.object({}),
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
      inputSchema: z.object({
        date: z.string().describe("The date to check in YYYY-MM-DD format"),
      }),
      execute: async ({ date }) => {
        console.log("[checkAvailability] Called with:", { date });
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
        "Create a new appointment booking. Use when a patient confirms they want to book. You MUST have the patient's name, phone number, date, and time before calling this. Always ask for the phone number if not provided.",
      inputSchema: z.object({
        patientName: z
          .string()
          .optional()
          .describe("Full name of the patient (preferred field)"),
        name: z.string().optional().describe("Alias for patientName"),
        patientPhone: z
          .string()
          .optional()
          .describe("Patient phone number (preferred field)"),
        phone: z.string().optional().describe("Alias for patientPhone"),
        date: z.string().describe("Appointment date in YYYY-MM-DD format"),
        time: z
          .string()
          .describe("Appointment time in HH:MM format (e.g., '09:00')"),
        serviceId: z.string().optional().describe("ID of the selected service"),
        serviceName: z
          .string()
          .optional()
          .describe("Service name if ID is unknown"),
        service: z
          .string()
          .optional()
          .describe("Alias for service name or service ID"),
        notes: z
          .string()
          .optional()
          .describe("Any additional notes about the appointment"),
      }),
      execute: async ({
        patientName,
        name,
        patientPhone,
        phone,
        date,
        time,
        serviceId,
        serviceName,
        service,
        notes,
      }) => {
        const normalizedPatientName = (patientName || name || "").trim();
        const normalizedPatientPhone = (patientPhone || phone || "").trim();
        const normalizedDate = date.trim();
        const normalizedTime = normalizeTimeInput(time);
        const requestedService = (serviceId || serviceName || service || "").trim();

        console.log("[createBooking] Called with:", {
          patientName: normalizedPatientName,
          patientPhone: normalizedPatientPhone,
          date: normalizedDate,
          time: normalizedTime,
          requestedService,
        });

        if (!normalizedPatientName) {
          return {
            success: false,
            message:
              "Patient name is required. Ask for the patient's full name before booking.",
          };
        }

        if (!normalizedPatientPhone) {
          return {
            success: false,
            message:
              "Phone number is required. Ask for the patient's phone number before booking.",
          };
        }

        if (!DATE_REGEX.test(normalizedDate)) {
          return {
            success: false,
            message:
              "Date must be in YYYY-MM-DD format (for example: 2026-02-16).",
          };
        }

        if (!TIME_REGEX.test(normalizedTime)) {
          return {
            success: false,
            message:
              "Time must be in HH:MM format (for example: 11:00 or 09:30).",
          };
        }

        let resolvedServiceId: string | null = null;
        let resolvedServiceName: string | null = null;
        let finalNotes = notes?.trim() || null;

        if (requestedService) {
          let matchedService:
            | {
                id: string;
                name: string;
              }
            | undefined;

          if (UUID_REGEX.test(requestedService)) {
            [matchedService] = await db
              .select({ id: services.id, name: services.name })
              .from(services)
              .where(
                and(
                  eq(services.id, requestedService),
                  eq(services.organizationId, organizationId),
                  eq(services.isActive, 1),
                ),
              );
          } else {
            [matchedService] = await db
              .select({ id: services.id, name: services.name })
              .from(services)
              .where(
                and(
                  eq(services.organizationId, organizationId),
                  eq(services.isActive, 1),
                  ilike(services.name, `%${requestedService}%`),
                ),
              );
          }

          if (matchedService) {
            resolvedServiceId = matchedService.id;
            resolvedServiceName = matchedService.name;
          } else {
            const requestedServiceNote = `Requested service: ${requestedService}`;
            finalNotes = finalNotes
              ? `${finalNotes}\n${requestedServiceNote}`
              : requestedServiceNote;
          }
        }

        const bookingChatId = UUID_REGEX.test(chatId) ? chatId : null;

        const existing = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.date, normalizedDate),
              eq(bookings.time, normalizedTime),
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

        try {
          const [newBooking] = await db
            .insert(bookings)
            .values({
              organizationId,
              serviceId: resolvedServiceId,
              patientName: normalizedPatientName,
              patientPhone: normalizedPatientPhone,
              date: normalizedDate,
              time: normalizedTime,
              notes: finalNotes,
              source: "chat",
              chatId: bookingChatId,
            })
            .returning();

          return {
            success: true,
            bookingId: newBooking.id,
            message: `Booking confirmed for ${normalizedPatientName} on ${normalizedDate} at ${normalizedTime}${resolvedServiceName ? ` for ${resolvedServiceName}` : ""}.`,
          };
        } catch (error) {
          console.error("[createBooking] Insert failed:", error);
          return {
            success: false,
            message:
              "Failed to create booking due to an internal error. Please try again.",
          };
        }
      },
    }),

    lookupBooking: tool({
      description:
        "Look up existing bookings by patient name and/or phone number. Use when a patient wants to check, cancel, or reschedule an appointment. ALWAYS provide both name and phone if you have them — some bookings may only have a name without phone.",
      inputSchema: z.object({
        patientName: z
          .string()
          .optional()
          .describe("Patient name to search for — ALWAYS include if known"),
        name: z.string().optional().describe("Alias for patientName"),
        patientPhone: z
          .string()
          .optional()
          .describe("Patient phone to search for"),
        phone: z.string().optional().describe("Alias for patientPhone"),
      }),
      execute: async ({ patientName, name, patientPhone, phone }) => {
        const resolvedPatientName = (patientName || name || "").trim();
        const resolvedPatientPhone = (patientPhone || phone || "").trim();

        console.log("[lookupBooking] Called with:", {
          patientName: resolvedPatientName,
          patientPhone: resolvedPatientPhone,
        });
        let results: any[] = [];

        if (resolvedPatientPhone) {
          // Strip non-digits for comparison to handle +380, spaces, dashes etc.
          const digits = resolvedPatientPhone.replace(/\D/g, "");
          const suffix = digits.length > 9 ? digits.slice(-9) : digits;
          results = await db.query.bookings.findMany({
            where: and(
              eq(bookings.organizationId, organizationId),
              sql`regexp_replace(${bookings.patientPhone}, '\\D', '', 'g') LIKE ${'%' + suffix}`,
            ),
            with: { service: true },
            orderBy: (bookings, { desc }) => [desc(bookings.date)],
            limit: 10,
          });
        }

        if (results.length === 0 && resolvedPatientName) {
          results = await db.query.bookings.findMany({
            where: and(
              eq(bookings.organizationId, organizationId),
              ilike(bookings.patientName, `%${resolvedPatientName}%`),
            ),
            with: { service: true },
            orderBy: (bookings, { desc }) => [desc(bookings.date)],
            limit: 10,
          });
        }

        return results.map((b) => ({
          id: b.id,
          patientName: b.patientName,
          patientPhone: b.patientPhone,
          date: b.date,
          time: b.time,
          status: b.status,
          service: b.service?.name || "General",
          notes: b.notes,
        }));
      },
    }),

    updateBooking: tool({
      description:
        "Update an existing booking — reschedule to a new date/time or cancel it. Use lookupBooking first to find the booking ID. When rescheduling, check availability for the new date first.",
      inputSchema: z.object({
        bookingId: z.string().describe("The ID of the booking to update"),
        action: z.enum(["reschedule", "cancel"]).describe("What to do: reschedule or cancel"),
        newDate: z.string().optional().describe("New date in YYYY-MM-DD format (required for reschedule)"),
        newTime: z.string().optional().describe("New time in HH:MM format (required for reschedule)"),
      }),
      execute: async ({ bookingId, action, newDate, newTime }) => {
        console.log("[updateBooking] Called with:", { bookingId, action, newDate, newTime });
        const [existing] = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.id, bookingId),
              eq(bookings.organizationId, organizationId),
            ),
          );

        if (!existing) {
          return { success: false, message: "Booking not found." };
        }

        if (existing.status === "cancelled") {
          return { success: false, message: "This booking is already cancelled." };
        }

        if (action === "cancel") {
          await db
            .update(bookings)
            .set({ status: "cancelled" })
            .where(eq(bookings.id, bookingId));
          return {
            success: true,
            message: `Booking for ${existing.patientName} on ${existing.date} at ${existing.time} has been cancelled.`,
          };
        }

        // reschedule
        if (!newDate || !newTime) {
          return { success: false, message: "New date and time are required for rescheduling." };
        }

        // Check if the new slot is available
        const [conflict] = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.organizationId, organizationId),
              eq(bookings.date, newDate),
              eq(bookings.time, newTime),
              eq(bookings.status, "confirmed"),
            ),
          );

        if (conflict && conflict.id !== bookingId) {
          return {
            success: false,
            message: `Time slot ${newTime} on ${newDate} is already taken. Please choose another time.`,
          };
        }

        await db
          .update(bookings)
          .set({ date: newDate, time: newTime })
          .where(eq(bookings.id, bookingId));

        return {
          success: true,
          message: `Booking for ${existing.patientName} rescheduled from ${existing.date} ${existing.time} to ${newDate} ${newTime}.`,
        };
      },
    }),
  };
}
