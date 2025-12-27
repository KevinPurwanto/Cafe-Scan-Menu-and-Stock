import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireEnv } from "./env";

export type AdminSession = {
  id: string;
  username: string;
  email: string;
  role: string;
};

const ADMIN_COOKIE_NAME = "admin_session";

function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (!name) return;
    cookies[name] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

export function signAdminSession(payload: AdminSession) {
  const secret = requireEnv("ADMIN_JWT_SECRET");
  const ttl = process.env.ADMIN_SESSION_TTL ?? "7d";
  return jwt.sign(payload, secret, { expiresIn: ttl });
}

export function setAdminSessionCookie(res: Response, token: string, secure = false) {
  const days = Number(process.env.ADMIN_SESSION_DAYS ?? "7");
  const maxAge = Math.max(days, 1) * 24 * 60 * 60;
  const secureFlag = secure ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
  );
}

export function clearAdminSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function getAdminSession(req: Request, requireSecret = false): AdminSession | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) return null;

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    if (requireSecret) throw new Error("Missing env: ADMIN_JWT_SECRET");
    return null;
  }

  try {
    return jwt.verify(token, secret) as AdminSession;
  } catch (_err) {
    return null;
  }
}
