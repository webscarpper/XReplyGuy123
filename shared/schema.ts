import { pgTable, text, integer, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  walletAddress: text("wallet_address").notNull().unique(),
  invitationCode: text("invitation_code"),
  tier: text("tier").notNull().default("free"),
  dailyLimit: integer("daily_limit").notNull().default(20),
  usageToday: integer("usage_today").notNull().default(0),
  subscriptionStartDate: timestamp("subscription_start_date").defaultNow().notNull(),
  subscriptionExpires: timestamp("subscription_expires").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invitationCodes = pgTable("invitation_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  tier: text("tier").notNull(),
  actionsPerDay: integer("actions_per_day").notNull(),
  usedByUserId: integer("used_by_user_id"),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userRelations = relations(users, ({ one }) => ({
  invitationCode: one(invitationCodes, {
    fields: [users.invitationCode],
    references: [invitationCodes.code],
  }),
}));

export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft, active, paused, stopped
  targetKeywords: text("target_keywords").array(),
  targetAccounts: text("target_accounts").array(),
  replyStyle: text("reply_style"),
  customInstructions: text("custom_instructions"),
  dailyLimit: integer("daily_limit").default(50),
  activeHours: text("active_hours"), // JSON string
  stealthSettings: text("stealth_settings"), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationActions = pgTable("automation_actions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id),
  actionType: text("action_type").notNull(), // like, reply, follow
  targetPostUrl: text("target_post_url"),
  targetUser: text("target_user"),
  content: text("content"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const browserSessions = pgTable("browser_sessions", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").notNull().references(() => automations.id),
  sessionId: text("session_id").notNull().unique(),
  status: text("status").notNull().default("starting"), // starting, waiting_login, active, stopped, error
  browserUrl: text("browser_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export const invitationCodeRelations = relations(invitationCodes, ({ one }) => ({
  usedByUser: one(users, {
    fields: [invitationCodes.usedByUserId],
    references: [users.id],
  }),
}));

export const automationRelations = relations(automations, ({ one, many }) => ({
  user: one(users, {
    fields: [automations.userId],
    references: [users.id],
  }),
  actions: many(automationActions),
  sessions: many(browserSessions),
}));

export const automationActionRelations = relations(automationActions, ({ one }) => ({
  automation: one(automations, {
    fields: [automationActions.automationId],
    references: [automations.id],
  }),
}));

export const browserSessionRelations = relations(browserSessions, ({ one }) => ({
  automation: one(automations, {
    fields: [browserSessions.automationId],
    references: [automations.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  walletAddress: true,
  invitationCode: true,
  tier: true,
  dailyLimit: true,
  usageToday: true,
  subscriptionStartDate: true,
  subscriptionExpires: true,
  isActive: true,
});

export const insertInvitationCodeSchema = createInsertSchema(invitationCodes).pick({
  code: true,
  tier: true,
  actionsPerDay: true,
});

export const insertAutomationSchema = createInsertSchema(automations).pick({
  userId: true,
  name: true,
  status: true,
  targetKeywords: true,
  targetAccounts: true,
  replyStyle: true,
  customInstructions: true,
  dailyLimit: true,
  activeHours: true,
  stealthSettings: true,
});

export const insertAutomationActionSchema = createInsertSchema(automationActions).pick({
  automationId: true,
  actionType: true,
  targetPostUrl: true,
  targetUser: true,
  content: true,
  status: true,
});

export const insertBrowserSessionSchema = createInsertSchema(browserSessions).pick({
  automationId: true,
  sessionId: true,
  status: true,
  browserUrl: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertInvitationCode = z.infer<typeof insertInvitationCodeSchema>;
export type InvitationCode = typeof invitationCodes.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomationAction = z.infer<typeof insertAutomationActionSchema>;
export type AutomationAction = typeof automationActions.$inferSelect;
export type InsertBrowserSession = z.infer<typeof insertBrowserSessionSchema>;
export type BrowserSession = typeof browserSessions.$inferSelect;
