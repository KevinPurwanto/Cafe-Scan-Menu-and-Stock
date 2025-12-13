import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Async handler wrapper to catch errors in async route handlers
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors
    });
  }

  // Handle Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry. Record already exists."
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: "Record not found"
    });
  }

  // Handle custom HttpError
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      success: false,
      message: err.message
    });
  }

  // Log unexpected errors for debugging
  console.error('Unexpected error:', err);

  // Default error response
  const status = err?.status ?? 500;
  const message = err?.message ?? "Internal Server Error";
  res.status(status).json({ success: false, message });
}
