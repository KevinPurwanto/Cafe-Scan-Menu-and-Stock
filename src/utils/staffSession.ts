import type { Request, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { requireEnv } from "./env";
import type { AdminSession } from "./adminSession";

const STAFF_COOKIE_NAME = "staff_session";

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

export function signStaffSession(payload: AdminSession) {
  const secret = requireEnv("ADMIN_JWT_SECRET");
  const ttl = process.env.STAFF_SESSION_TTL ?? "7d";
  const expiresIn: SignOptions["expiresIn"] = /^\d+$/.test(ttl)
    ? Number(ttl)
    : (ttl as SignOptions["expiresIn"]);
  return jwt.sign(payload, secret, { expiresIn });
}

export function setStaffSessionCookie(res: Response, token: string, secure = false) {
  const days = Number(process.env.STAFF_SESSION_DAYS ?? "7");
  const maxAge = Math.max(days, 1) * 24 * 60 * 60;
  const secureFlag = secure ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${STAFF_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag}`
  );
}

export function clearStaffSessionCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    `${STAFF_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

export function getStaffSession(req: Request, requireSecret = false): AdminSession | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[STAFF_COOKIE_NAME];
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
