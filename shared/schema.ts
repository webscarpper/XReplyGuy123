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

export const invitationCodeRelations = relations(invitationCodes, ({ one }) => ({
  usedByUser: one(users, {
    fields: [invitationCodes.usedByUserId],
    references: [users.id],
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertInvitationCode = z.infer<typeof insertInvitationCodeSchema>;
export type InvitationCode = typeof invitationCodes.$inferSelect;
