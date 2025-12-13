import express from "express";
import cors from "cors";
import { errorHandler } from "./utils/errors";

import healthRoutes from "./routes/health.routes";
import tablesRoutes from "./routes/tables.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import reportsRoutes from "./routes/reports.routes";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/health", healthRoutes);
  app.use("/tables", tablesRoutes);
  app.use("/menu", menuRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/reports", reportsRoutes);

  app.use(errorHandler);
  return app;
}
