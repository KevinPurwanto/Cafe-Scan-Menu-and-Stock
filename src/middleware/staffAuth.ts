import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors";

export function staffAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  if (!process.env.ADMIN_API_KEY) throw new Error("Missing env: ADMIN_API_KEY");
  if (!process.env.KITCHEN_API_KEY) throw new Error("Missing env: KITCHEN_API_KEY");

  const isAdmin = key === process.env.ADMIN_API_KEY;
  const isKitchen = key === process.env.KITCHEN_API_KEY;
  if (!isAdmin && !isKitchen) throw new HttpError(401, "Unauthorized");

  next();
}
