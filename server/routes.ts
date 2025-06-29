import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authRoutes } from "./routes/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes for wallet authentication
  app.use("/api/auth", authRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
