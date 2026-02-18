import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@/db";
import { services, bookings } from "@/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

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

export function createMcpServer(organizationId: string): McpServer {
  const server = new McpServer({
    name: "ai-receptionist",
    version: "1.0.0",
  });

  server.tool(
    "resolveDate",
    "Converts any relative date to YYYY-MM-DD. Always resolves to the nearest upcoming occurrence. Pass the expression exactly as the patient said it.",
    {
      expression: z
        .string()
        .describe(
          "Date expression exactly as said: 'завтра', 'п'ятниця', 'next friday', 'через 3 дні', etc.",
        ),
    },
    async ({ expression }) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const expr = expression.toLowerCase().trim();

      // All day name mappings — always resolves to nearest upcoming
      const allDayNames: Record<string, number> = {
        // English
        sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2,
        wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5,
        saturday: 6, sat: 6,
        // Ukrainian
        "неділ": 0, "понеділ": 1, "вівтор": 2, "серед": 3,
        "четвер": 4, "п'ятниц": 5, "пятниц": 5, "субот": 6,
        // Russian
        "воскресен": 0, "понедельник": 1, "вторник": 2, "сред": 3,
        "пятниц": 5, "суббот": 6,
      };

      let resolved: Date | null = null;

      // Today
      if (expr === "today" || expr === "сьогодні" || expr === "сегодня") {
        resolved = today;
      }
      // Tomorrow
      else if (expr === "tomorrow" || expr === "завтра") {
        resolved = new Date(today);
        resolved.setDate(resolved.getDate() + 1);
      }
      // Day after tomorrow
      else if (expr === "day after tomorrow" || expr === "післязавтра" || expr === "послезавтра") {
        resolved = new Date(today);
        resolved.setDate(resolved.getDate() + 2);
      }

      // "in N days" / "через N днів"
      if (!resolved) {
        const nDays = expr.match(/(?:in\s+|через\s+)(\d+)\s*(?:days?|дн|день|дні|дней)/);
        if (nDays) {
          resolved = new Date(today);
          resolved.setDate(resolved.getDate() + parseInt(nDays[1]));
        }
      }

      // "in N weeks" / "через N тижнів"
      if (!resolved) {
        const nWeeks = expr.match(/(?:in\s+|через\s+)(\d+)\s*(?:weeks?|тижн|недел)/);
        if (nWeeks) {
          resolved = new Date(today);
          resolved.setDate(resolved.getDate() + parseInt(nWeeks[1]) * 7);
        }
      }

      // Day name — always nearest upcoming (no "next" vs "this" distinction)
      if (!resolved) {
        for (const [name, target] of Object.entries(allDayNames)) {
          if (expr.includes(name)) {
            const current = today.getDay();
            let diff = target - current;
            if (diff <= 0) diff += 7;
            resolved = new Date(today);
            resolved.setDate(resolved.getDate() + diff);
            break;
          }
        }
      }

      if (!resolved) {
        // Try to parse as a direct date (e.g. "20 лютого", "February 20", "20.02")
        const directDate = new Date(expr);
        if (!isNaN(directDate.getTime())) {
          resolved = directDate;
        }
      }

      if (!resolved) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              message: `Could not resolve "${expression}". Ask the patient for a specific date.`,
            }),
          }],
        };
      }

      const yyyy = resolved.getFullYear();
      const mm = String(resolved.getMonth() + 1).padStart(2, "0");
      const dd = String(resolved.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayNameUa = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            date: dateStr,
            dayOfWeek: dayNameUa[resolved.getDay()],
            isWorkday: resolved.getDay() !== 0,
          }),
        }],
      };
    },
  );

  server.tool(
    "listServices",
    "Returns all active services with prices and durations. Call silently before any booking.",
    {},
    async () => {
      const allServices = await db
        .select()
        .from(services)
        .where(
          and(
            eq(services.organizationId, organizationId),
            eq(services.isActive, 1),
          ),
        );

      const result = allServices.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: `${(s.price / 100).toFixed(0)} UAH`,
        duration: `${s.duration} minutes`,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "checkAvailability",
    "Returns available time slots for a date. Call silently before booking. Date format: YYYY-MM-DD.",
    { date: z.string().describe("The date to check in YYYY-MM-DD format") },
    async ({ date }) => {
      const dayOfWeek = new Date(date).getDay();

      if (dayOfWeek === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                date,
                closed: true,
                message:
                  "The clinic is closed on Sundays. Please choose another day.",
                availableSlots: [],
                totalSlots: 0,
                bookedSlots: 0,
              }),
            },
          ],
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

      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const result = {
        date,
        dayOfWeek: dayNames[dayOfWeek],
        workingHours: `${startHour.toString().padStart(2, "0")}:00–${endHour.toString().padStart(2, "0")}:00`,
        availableSlots: allSlots.filter((s) => !bookedTimes.has(s)),
        totalSlots: allSlots.length,
        bookedSlots: bookedTimes.size,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "createBooking",
    "Creates an appointment. Requires patient name, phone, date (YYYY-MM-DD), time (HH:MM). Call listServices and checkAvailability first.",
    {
      patientName: z.string().describe("Full name of the patient"),
      patientPhone: z.string().describe("Patient phone number"),
      date: z.string().describe("Appointment date in YYYY-MM-DD format"),
      time: z
        .string()
        .describe("Appointment time in HH:MM format (e.g., '09:00')"),
      serviceName: z
        .string()
        .optional()
        .describe("Name of the selected service"),
      notes: z
        .string()
        .optional()
        .describe("Any additional notes about the appointment"),
    },
    async ({ patientName, patientPhone, date, time, serviceName, notes }) => {
      const normalizedTime = normalizeTimeInput(time);

      if (!patientName.trim()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "Patient name is required. Ask for the patient's full name before booking.",
              }),
            },
          ],
        };
      }

      if (!patientPhone.trim()) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "Phone number is required. Ask for the patient's phone number before booking.",
              }),
            },
          ],
        };
      }

      if (!DATE_REGEX.test(date)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "Date must be in YYYY-MM-DD format (for example: 2026-02-16).",
              }),
            },
          ],
        };
      }

      if (!TIME_REGEX.test(normalizedTime)) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "Time must be in HH:MM format (for example: 11:00 or 09:30).",
              }),
            },
          ],
        };
      }

      let resolvedServiceId: string | null = null;
      let resolvedServiceName: string | null = null;
      let finalNotes = notes?.trim() || null;

      if (serviceName?.trim()) {
        const [matchedService] = await db
          .select({ id: services.id, name: services.name })
          .from(services)
          .where(
            and(
              eq(services.organizationId, organizationId),
              eq(services.isActive, 1),
              ilike(services.name, `%${serviceName.trim()}%`),
            ),
          );

        if (matchedService) {
          resolvedServiceId = matchedService.id;
          resolvedServiceName = matchedService.name;
        } else {
          const requestedServiceNote = `Requested service: ${serviceName}`;
          finalNotes = finalNotes
            ? `${finalNotes}\n${requestedServiceNote}`
            : requestedServiceNote;
        }
      }

      const existing = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.organizationId, organizationId),
            eq(bookings.date, date),
            eq(bookings.time, normalizedTime),
            eq(bookings.status, "confirmed"),
          ),
        );

      if (existing.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "This time slot is no longer available. Please choose another time.",
              }),
            },
          ],
        };
      }

      try {
        const [newBooking] = await db
          .insert(bookings)
          .values({
            organizationId,
            serviceId: resolvedServiceId,
            patientName: patientName.trim(),
            patientPhone: patientPhone.trim(),
            date,
            time: normalizedTime,
            notes: finalNotes,
            source: "elevenlabs",
          })
          .returning();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                bookingId: newBooking.id,
                message: `Booking confirmed for ${patientName.trim()} on ${date} at ${normalizedTime}${resolvedServiceName ? ` for ${resolvedServiceName}` : ""}.`,
              }),
            },
          ],
        };
      } catch (error) {
        console.error("[MCP createBooking] Insert failed:", error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "Failed to create booking due to an internal error. Please try again.",
              }),
            },
          ],
        };
      }
    },
  );

  server.tool(
    "lookupBooking",
    "Finds existing bookings by patient name. Returns booking IDs for use with updateBooking.",
    {
      patientName: z
        .string()
        .describe("Patient name to search for — REQUIRED, always ask for the name"),
      patientPhone: z
        .string()
        .optional()
        .describe("Patient phone — only used as fallback if name is not available"),
    },
    async ({ patientName, patientPhone }) => {
      const resolvedName = (patientName || "").trim();
      const resolvedPhone = (patientPhone || "").trim();

      let results: any[] = [];

      if (resolvedName) {
        results = await db.query.bookings.findMany({
          where: and(
            eq(bookings.organizationId, organizationId),
            ilike(bookings.patientName, `%${resolvedName}%`),
          ),
          with: { service: true },
          orderBy: (bookings, { desc }) => [desc(bookings.date)],
          limit: 10,
        });
      }

      if (results.length === 0 && resolvedPhone) {
        const digits = resolvedPhone.replace(/\D/g, "");
        const suffix = digits.length > 9 ? digits.slice(-9) : digits;
        results = await db.query.bookings.findMany({
          where: and(
            eq(bookings.organizationId, organizationId),
            sql`regexp_replace(${bookings.patientPhone}, '\\D', '', 'g') LIKE ${"%" + suffix}`,
          ),
          with: { service: true },
          orderBy: (bookings, { desc }) => [desc(bookings.date)],
          limit: 10,
        });
      }

      const mapped = results.map((b) => ({
        id: b.id,
        patientName: b.patientName,
        patientPhone: b.patientPhone,
        date: b.date,
        time: b.time,
        status: b.status,
        service: b.service?.name || "General",
        notes: b.notes,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(mapped) }],
      };
    },
  );

  server.tool(
    "updateBooking",
    "Reschedules or cancels a booking. Use lookupBooking first to get the bookingId. For reschedule: check availability for new date first.",
    {
      bookingId: z.string().describe("The ID of the booking to update"),
      action: z
        .enum(["reschedule", "cancel"])
        .describe("What to do: reschedule or cancel"),
      newDate: z
        .string()
        .optional()
        .describe("New date in YYYY-MM-DD format (required for reschedule)"),
      newTime: z
        .string()
        .optional()
        .describe("New time in HH:MM format (required for reschedule)"),
    },
    async ({ bookingId, action, newDate, newTime }) => {
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
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message: "Booking not found.",
              }),
            },
          ],
        };
      }

      if (existing.status === "cancelled") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message: "This booking is already cancelled.",
              }),
            },
          ],
        };
      }

      if (action === "cancel") {
        await db
          .update(bookings)
          .set({ status: "cancelled" })
          .where(eq(bookings.id, bookingId));
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Booking for ${existing.patientName} on ${existing.date} at ${existing.time} has been cancelled.`,
              }),
            },
          ],
        };
      }

      if (!newDate || !newTime) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message:
                  "New date and time are required for rescheduling.",
              }),
            },
          ],
        };
      }

      const normalizedNewTime = normalizeTimeInput(newTime);

      const [conflict] = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.organizationId, organizationId),
            eq(bookings.date, newDate),
            eq(bookings.time, normalizedNewTime),
            eq(bookings.status, "confirmed"),
          ),
        );

      if (conflict && conflict.id !== bookingId) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                message: `Time slot ${normalizedNewTime} on ${newDate} is already taken. Please choose another time.`,
              }),
            },
          ],
        };
      }

      await db
        .update(bookings)
        .set({ date: newDate, time: normalizedNewTime })
        .where(eq(bookings.id, bookingId));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: `Booking for ${existing.patientName} rescheduled from ${existing.date} ${existing.time} to ${newDate} ${normalizedNewTime}.`,
            }),
          },
        ],
      };
    },
  );

  return server;
}
