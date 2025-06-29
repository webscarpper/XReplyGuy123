import { users, invitationCodes, type User, type InsertUser, type InvitationCode, type InsertInvitationCode } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByWalletAddress(walletAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserUsage(userId: number, usageToday: number): Promise<void>;
  resetDailyUsage(): Promise<void>;
  getInvitationCode(code: string): Promise<InvitationCode | undefined>;
  createInvitationCode(inviteCode: InsertInvitationCode): Promise<InvitationCode>;
  markInvitationCodeAsUsed(code: string, userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getInvitationCode(code: string): Promise<InvitationCode | undefined> {
    const [inviteCode] = await db.select().from(invitationCodes).where(eq(invitationCodes.code, code));
    return inviteCode || undefined;
  }

  async createInvitationCode(inviteCode: InsertInvitationCode): Promise<InvitationCode> {
    const [code] = await db
      .insert(invitationCodes)
      .values(inviteCode)
      .returning();
    return code;
  }

  async markInvitationCodeAsUsed(code: string, userId: number): Promise<void> {
    await db
      .update(invitationCodes)
      .set({ isUsed: true, usedByUserId: userId })
      .where(eq(invitationCodes.code, code));
  }

  async updateUserUsage(userId: number, usageToday: number): Promise<void> {
    await db
      .update(users)
      .set({ usageToday })
      .where(eq(users.id, userId));
  }

  async resetDailyUsage(): Promise<void> {
    await db
      .update(users)
      .set({ usageToday: 0 });
  }
}

export const storage = new DatabaseStorage();
