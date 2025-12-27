import express from "express";
import path from "path";
import cors from "cors";
import { errorHandler } from "./utils/errors";
import { requireEnv } from "./utils/env";

import healthRoutes from "./routes/health.routes";
import tablesRoutes from "./routes/tables.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import reportsRoutes from "./routes/reports.routes";
import authRoutes from "./routes/auth.routes";
import { seedAdminUser } from "./modules/admin/admin.seed";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  requireEnv("ADMIN_JWT_SECRET");

  const frontendPath = path.resolve(__dirname, "..", "frontend");
  const indexPath = path.resolve(frontendPath, "index.html");
  const customerPath = path.resolve(frontendPath, "customer.html");
  const adminPath = path.resolve(frontendPath, "admin.html");
  const kitchenPath = path.resolve(frontendPath, "kitchen.html");

  app.use("/health", healthRoutes);
  app.use("/tables", tablesRoutes);
  app.use("/menu", menuRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/reports", reportsRoutes);
  app.use("/auth", authRoutes);

  seedAdminUser().catch((err) => {
    console.error("Admin seed failed:", err);
  });

  app.get("/", (_req, res) => res.redirect("/customer"));
  app.get("/index.html", (_req, res) => res.sendFile(indexPath));
  app.get("/customer", (_req, res) => res.sendFile(customerPath));
  app.get("/customer.html", (_req, res) => res.sendFile(customerPath));
  app.get("/admin", (_req, res) => res.sendFile(adminPath));
  app.get("/admin.html", (_req, res) => res.redirect("/admin"));
  app.get("/kitchen", (_req, res) => res.sendFile(kitchenPath));
  app.get("/kitchen.html", (_req, res) => res.sendFile(kitchenPath));
  app.use(express.static(frontendPath));

  app.use(errorHandler);
  return app;
}
