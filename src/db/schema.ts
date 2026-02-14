import { relations } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { DEFAULT_WIDGET_CONFIG } from "@/lib/widget/defaults";

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  prompt: text("prompt"),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  messages: json("messages").$type<any[]>().default([]).notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  isTest: integer("is_test").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("chats_org_id_idx").on(table.organizationId),
  index("chats_org_test_idx").on(table.organizationId, table.isTest),
  index("chats_created_at_idx").on(table.createdAt),
]);

export const widgetSettings = pgTable("widget_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  primaryColor: varchar("primary_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.primaryColor,
  ),
  backgroundColor: varchar("background_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.backgroundColor,
  ),
  secondaryColor: varchar("secondary_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.secondaryColor,
  ),
  textPrimaryColor: varchar("text_primary_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.textPrimaryColor,
  ),
  textSecondaryColor: varchar("text_secondary_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.textSecondaryColor,
  ),
  borderColor: varchar("border_color", { length: 7 }).default(
    DEFAULT_WIDGET_CONFIG.borderColor,
  ),

  headerTitle: varchar("header_title", { length: 100 }).default(
    DEFAULT_WIDGET_CONFIG.headerTitle,
  ),
  inputPlaceholder: varchar("input_placeholder", { length: 200 }).default(
    DEFAULT_WIDGET_CONFIG.inputPlaceholder,
  ),
  initialMessage: text("initial_message").default(
    DEFAULT_WIDGET_CONFIG.initialMessage,
  ),
  showBranding: integer("show_branding").default(1),
  brandingText: varchar("branding_text", { length: 100 }),

  welcomeTitle: varchar("welcome_title", { length: 100 }),
  welcomeSubtitle: varchar("welcome_subtitle", { length: 200 }),
  nameLabel: varchar("name_label", { length: 50 }),
  namePlaceholder: varchar("name_placeholder", { length: 100 }),
  startChatButtonText: varchar("start_chat_button_text", { length: 50 }),

  enableQuickReplies: integer("enable_quick_replies").default(1),
  quickReplies: json("quick_replies").$type<string[]>(),
  enableTimeTrigger: integer("enable_time_trigger").default(1),
  timeTriggerSeconds: integer("time_trigger_seconds").default(15),

  logoUrl: text("logo_url"),
  logoKey: text("logo_key"),
  logoWidth: integer("logo_width").default(100),
  logoHeight: integer("logo_height").default(40),
  logoBorderRadius: integer("logo_border_radius").default(8),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // price in cents
  duration: integer("duration").notNull(), // duration in minutes
  isActive: integer("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("services_org_id_idx").on(table.organizationId),
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  serviceId: uuid("service_id")
    .references(() => services.id, { onDelete: "set null" }),
  patientName: text("patient_name").notNull(),
  patientPhone: text("patient_phone"),
  patientEmail: text("patient_email"),
  date: text("date").notNull(), // "2026-03-15"
  time: text("time").notNull(), // "09:00"
  status: text("status").default("confirmed").notNull(),
  notes: text("notes"),
  source: text("source").default("dashboard").notNull(), // dashboard, chat, elevenlabs, telegram, email
  chatId: uuid("chat_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("bookings_org_id_idx").on(table.organizationId),
  index("bookings_date_idx").on(table.organizationId, table.date),
  index("bookings_service_idx").on(table.serviceId),
]);

export const chatsRelations = relations(chats, ({ one }) => ({
  organization: one(organizations, {
    fields: [chats.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    chats: many(chats),
    widgetSettings: one(widgetSettings, {
      fields: [organizations.id],
      references: [widgetSettings.organizationId],
    }),
    services: many(services),
    bookings: many(bookings),
  }),
);

export const widgetSettingsRelations = relations(widgetSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [widgetSettings.organizationId],
    references: [organizations.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.organizationId],
    references: [organizations.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
}));

