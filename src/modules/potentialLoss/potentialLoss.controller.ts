import { Request, Response } from "express";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

/**
 * POST /potential-loss
 * Public endpoint — dipanggil dari halaman customer ketika qty melebihi stok.
 * Body: { menuItemId?, menuName, price, requestedQty, stockAvailable, tableNumber? }
 */
export async function recordPotentialLoss(req: Request, res: Response) {
  const { menuItemId, menuName, price, requestedQty, stockAvailable, tableNumber } = req.body;

  if (!menuName || typeof menuName !== "string") {
    throw new HttpError(400, "menuName is required");
  }
  if (typeof requestedQty !== "number" || requestedQty < 1) {
    throw new HttpError(400, "requestedQty must be a positive number");
  }
  if (typeof stockAvailable !== "number" || stockAvailable < 0) {
    throw new HttpError(400, "stockAvailable must be a non-negative number");
  }
  if (requestedQty <= stockAvailable) {
    throw new HttpError(400, "requestedQty must exceed stockAvailable to record a potential loss");
  }

  const lostQty = requestedQty - stockAvailable;
  const safePrice = typeof price === "number" && price >= 0 ? price : 0;

  await prisma.potentialLoss.create({
    data: {
      menuItemId: menuItemId ?? null,
      menuName: menuName.trim(),
      price: safePrice,
      requestedQty,
      stockAvailable,
      lostQty,
      tableNumber: typeof tableNumber === "number" ? tableNumber : null
    }
  });

  res.status(201).json({ success: true, message: "Potential loss recorded", lostQty });
}

/**
 * GET /potential-loss
 * Admin endpoint — ambil semua potential loss dalam rentang waktu tertentu.
 * Query: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export async function getPotentialLosses(req: Request, res: Response) {
  const startStr = req.query.start?.toString();
  const endStr   = req.query.end?.toString();

  const startDate = startStr ? new Date(`${startStr}T00:00:00`) : new Date(0);
  const endDate   = endStr   ? new Date(`${endStr}T23:59:59`)   : new Date();

  const records = await prisma.potentialLoss.findMany({
    where: { recordedAt: { gte: startDate, lte: endDate } },
    orderBy: { recordedAt: "desc" }
  });

  const totalLostQty     = records.reduce((s, r) => s + r.lostQty, 0);
  const totalRevenueLoss = records.reduce((s, r) => s + r.lostQty * r.price, 0);

  res.json({ success: true, data: { records, totalLostQty, totalRevenueLoss } });
}
