import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "../db";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler, HttpError } from "../utils/errors";
import {
  clearAdminSessionCookie,
  getAdminSession,
  setAdminSessionCookie,
  signAdminSession
} from "../utils/adminSession";
import {
  clearStaffSessionCookie,
  getStaffSession,
  setStaffSessionCookie,
  signStaffSession
} from "../utils/staffSession";

const r = Router();

const sanitizeAdmin = (admin: { id: string; username: string; email: string; role: string }) => ({
  id: admin.id,
  username: admin.username,
  email: admin.email,
  role: admin.role
});

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const adminRoles = new Set(["admin", "owner"]);
const staffRoles = new Set(["admin", "owner", "kitchen", "staff"]);

const ensurePassword = (password: string) => {
  if (password.length < 8) {
    throw new HttpError(400, "Password minimal 8 karakter.");
  }
};

const hashResetToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildResetUrl = (req: { protocol: string; get(name: string): string | undefined }, token: string) => {
  const base = (process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`)
    .replace(/\/$/, "");
  return `${base}/reset-password.html?token=${encodeURIComponent(token)}`;
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "0");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) {
    throw new HttpError(500, "Email reset belum dikonfigurasi.");
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

const sendResetEmail = async (to: string, resetUrl: string) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new HttpError(500, "Email reset belum dikonfigurasi.");
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: "Reset password admin",
    text: `Gunakan link berikut untuk reset password admin: ${resetUrl}`,
    html: `
      <p>Permintaan reset password admin diterima.</p>
      <p>Klik link berikut untuk melanjutkan:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Jika Anda tidak meminta reset, abaikan email ini.</p>
    `
  });
};

r.get(
  "/admin/me",
  asyncHandler(async (req, res) => {
    const session = getAdminSession(req, true);
    if (!session) throw new HttpError(401, "Unauthorized");
    if (!adminRoles.has(session.role)) throw new HttpError(403, "Forbidden");
    const admin = await prisma.adminUser.findUnique({ where: { id: session.id } });
    if (!admin) throw new HttpError(401, "Unauthorized");
    res.json({ success: true, data: sanitizeAdmin(admin) });
  })
);

r.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      throw new HttpError(400, "Username dan password wajib diisi.");
    }

    const admin = await prisma.adminUser.findFirst({
      where: { username }
    });

    if (!admin) throw new HttpError(401, "Username atau password salah.");
    if (!adminRoles.has(admin.role)) throw new HttpError(403, "Forbidden");

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new HttpError(401, "Username atau password salah.");

    const token = signAdminSession({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    });
    setAdminSessionCookie(res, token, req.secure);
    res.json({ success: true, data: sanitizeAdmin(admin) });
  })
);

r.post(
  "/admin/logout",
  asyncHandler(async (_req, res) => {
    clearAdminSessionCookie(res);
    res.json({ success: true });
  })
);

r.get(
  "/staff/me",
  asyncHandler(async (req, res) => {
    const session = getStaffSession(req, true);
    if (!session) throw new HttpError(401, "Unauthorized");
    if (!staffRoles.has(session.role)) throw new HttpError(403, "Forbidden");
    const staff = await prisma.adminUser.findUnique({ where: { id: session.id } });
    if (!staff) throw new HttpError(401, "Unauthorized");
    res.json({ success: true, data: sanitizeAdmin(staff) });
  })
);

r.post(
  "/staff/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      throw new HttpError(400, "Username dan password wajib diisi.");
    }

    const staff = await prisma.adminUser.findFirst({
      where: { username }
    });

    if (!staff) throw new HttpError(401, "Username atau password salah.");
    if (!staffRoles.has(staff.role)) throw new HttpError(403, "Forbidden");

    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) throw new HttpError(401, "Username atau password salah.");

    const token = signStaffSession({
      id: staff.id,
      username: staff.username,
      email: staff.email,
      role: staff.role
    });
    setStaffSessionCookie(res, token, req.secure);
    res.json({ success: true, data: sanitizeAdmin(staff) });
  })
);

r.post(
  "/staff/logout",
  asyncHandler(async (_req, res) => {
    clearStaffSessionCookie(res);
    res.json({ success: true });
  })
);

r.post(
  "/staff/forgot-password",
  asyncHandler(async (req, res) => {
    const allowedEmail = normalizeEmail(process.env.ADMIN_RESET_EMAIL || "");
    if (!allowedEmail) throw new HttpError(500, "Email reset belum dikonfigurasi.");

    const username = String(req.body?.username ?? "").trim();
    if (!username) throw new HttpError(400, "Username wajib diisi.");

    const staff = await prisma.adminUser.findUnique({ where: { username } });
    if (!staff || !staffRoles.has(staff.role)) {
      return res.json({
        success: true,
        message: "Jika akun terdaftar, link reset akan dikirim."
      });
    }

    await prisma.adminPasswordReset.deleteMany({
      where: { adminId: staff.id, usedAt: null }
    });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const ttlMinutes = Number(process.env.ADMIN_RESET_TOKEN_TTL_MINUTES ?? "60");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await prisma.adminPasswordReset.create({
      data: {
        adminId: staff.id,
        tokenHash,
        expiresAt
      }
    });

    const resetUrl = buildResetUrl(req, token);
    await sendResetEmail(allowedEmail, resetUrl);

    res.json({
      success: true,
      message: "Jika akun terdaftar, link reset akan dikirim."
    });
  })
);

r.post(
  "/admin/users",
  adminAuth,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    const role = String(req.body?.role ?? "admin").trim() || "admin";

    if (!username || !email || !password) {
      throw new HttpError(400, "Username, email, dan password wajib diisi.");
    }
    ensurePassword(password);

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await prisma.adminUser.create({
      data: { username, email, passwordHash, role }
    });
    res.status(201).json({ success: true, data: sanitizeAdmin(admin) });
  })
);

r.post(
  "/admin/forgot-password",
  asyncHandler(async (req, res) => {
    const allowedEmail = normalizeEmail(process.env.ADMIN_RESET_EMAIL || "");
    if (!allowedEmail) throw new HttpError(500, "Email reset belum dikonfigurasi.");

    const username = String(req.body?.username ?? "").trim();
    if (!username) throw new HttpError(400, "Username wajib diisi.");

    const admin = await prisma.adminUser.findUnique({ where: { username } });
    if (!admin || !adminRoles.has(admin.role)) {
      return res.json({
        success: true,
        message: "Jika akun terdaftar, link reset akan dikirim."
      });
    }

    await prisma.adminPasswordReset.deleteMany({
      where: { adminId: admin.id, usedAt: null }
    });

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const ttlMinutes = Number(process.env.ADMIN_RESET_TOKEN_TTL_MINUTES ?? "60");
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await prisma.adminPasswordReset.create({
      data: {
        adminId: admin.id,
        tokenHash,
        expiresAt
      }
    });

    const resetUrl = buildResetUrl(req, token);
    await sendResetEmail(allowedEmail, resetUrl);

    res.json({
      success: true,
      message: "Jika akun terdaftar, link reset akan dikirim."
    });
  })
);

r.post(
  "/admin/reset-password",
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!token || !password) throw new HttpError(400, "Token dan password wajib diisi.");
    ensurePassword(password);

    const tokenHash = hashResetToken(token);
    const reset = await prisma.adminPasswordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { admin: true }
    });

    if (!reset) throw new HttpError(400, "Token tidak valid atau kadaluarsa.");

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.adminUser.update({
        where: { id: reset.adminId },
        data: { passwordHash }
      }),
      prisma.adminPasswordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() }
      })
    ]);

    res.json({ success: true });
  })
);

export default r;
