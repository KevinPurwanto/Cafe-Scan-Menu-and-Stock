import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors";

export function adminAuth(req: Request, _res: Response, next: NextFunction) {
  const key = req.header("x-api-key");
  if (!process.env.ADMIN_API_KEY) throw new Error("Missing env: ADMIN_API_KEY");
  if (key !== process.env.ADMIN_API_KEY) throw new HttpError(401, "Unauthorized");
  next();
}
