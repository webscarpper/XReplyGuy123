import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authRoutes } from "./routes/auth";
import { automationRoutes } from "./routes/automations";
import { browserRoutes } from "./routes/browser";
import { aiRoutes } from "./routes/ai";
import testBrowserRoutes from "./routes/test-browser";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes for wallet authentication
  app.use("/api/auth", authRoutes);
  
  // Automation management routes
  app.use("/api/automations", automationRoutes);
  
  // Browser session management routes
  app.use("/api/bright-data", browserRoutes);
  
  // AI integration routes
  app.use("/api/ai", aiRoutes);
  
  // Test browser routes for Bright Data testing
  app.use("/api/test-browser", testBrowserRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
