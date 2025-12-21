import crypto from "crypto";
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

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const adminApiKey = requireEnv("ADMIN_API_KEY");
  const adminAuthToken = crypto
    .createHmac("sha256", adminApiKey)
    .update("admin-auth")
    .digest("hex");

  const frontendPath = path.resolve(__dirname, "..", "frontend");
  const indexPath = path.resolve(frontendPath, "index.html");
  const customerPath = path.resolve(frontendPath, "customer.html");
  const adminPath = path.resolve(frontendPath, "admin.html");

  const parseCookies = (cookieHeader?: string) => {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split("=");
      if (!name) return;
      cookies[name] = decodeURIComponent(rest.join("="));
    });
    return cookies;
  };

  const isAdminAuthed = (req: express.Request) => {
    const cookies = parseCookies(req.headers.cookie);
    return cookies.admin_auth === adminAuthToken;
  };

  const adminLoginPage = (message = "") =>
    `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Login</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; }
      .wrap { max-width: 420px; margin: 12vh auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { color: #6b7280; margin: 0 0 16px; }
      .error { color: #dc2626; margin-bottom: 12px; }
      input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
      button { width: 100%; margin-top: 12px; padding: 10px 12px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Masuk Admin</h1>
      <p>Masukkan password admin untuk melanjutkan.</p>
      ${message ? `<div class="error">${message}</div>` : ""}
      <form method="POST" action="/admin/login">
        <input type="password" name="password" placeholder="Password admin" required />
        <button type="submit">Masuk</button>
      </form>
    </div>
  </body>
</html>`;

  app.use("/health", healthRoutes);
  app.use("/tables", tablesRoutes);
  app.use("/menu", menuRoutes);
  app.use("/orders", ordersRoutes);
  app.use("/reports", reportsRoutes);

  app.get("/", (_req, res) => res.redirect("/customer"));
  app.get("/index.html", (_req, res) => res.sendFile(indexPath));
  app.get("/customer", (_req, res) => res.sendFile(customerPath));
  app.get("/customer.html", (_req, res) => res.sendFile(customerPath));
  app.get("/admin", (req, res) =>
    isAdminAuthed(req) ? res.sendFile(adminPath) : res.status(401).send(adminLoginPage())
  );
  app.get("/admin.html", (req, res) =>
    isAdminAuthed(req) ? res.sendFile(adminPath) : res.status(401).send(adminLoginPage())
  );
  app.post("/admin/login", (req, res) => {
    const password = String(req.body?.password ?? "").trim();
    if (password !== adminApiKey) {
      return res.status(401).send(adminLoginPage("Password salah."));
    }

    const secureFlag = req.secure ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `admin_auth=${encodeURIComponent(adminAuthToken)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}`
    );

    res.send(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Redirect</title>
  </head>
  <body>
    <script>
      sessionStorage.setItem('adminApiKey', ${JSON.stringify(password)});
      location.href = '/admin';
    </script>
  </body>
</html>`);
  });

  app.use(express.static(frontendPath));

  app.use(errorHandler);
  return app;
}
