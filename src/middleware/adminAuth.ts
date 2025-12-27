import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { getAdminSession } from "../utils/adminSession";

export function adminAuth(req: Request, _res: Response, next: NextFunction) {
  const session = getAdminSession(req, true);
  if (!session) throw new HttpError(401, "Unauthorized");
  if (session.role !== "admin" && session.role !== "owner") {
    throw new HttpError(403, "Forbidden");
  }
  (req as Request & { admin?: typeof session }).admin = session;
  next();
}
