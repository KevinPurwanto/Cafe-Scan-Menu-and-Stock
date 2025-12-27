import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors";
import { getAdminSession } from "../utils/adminSession";
import { getStaffSession } from "../utils/staffSession";

export function staffAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  const isAdmin = Boolean(getAdminSession(req));
  const isStaff = Boolean(getStaffSession(req));
  const hasKitchenKey = process.env.KITCHEN_API_KEY
    ? key === process.env.KITCHEN_API_KEY
    : false;
  if (!isAdmin && !isStaff && !hasKitchenKey) throw new HttpError(401, "Unauthorized");

  next();
}
