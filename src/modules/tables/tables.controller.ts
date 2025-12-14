import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";
import { generateTableQr } from "../../utils/qr";

export async function list(_req: Request, res: Response) {
  const data = await prisma.table.findMany({ orderBy: { tableNumber: "asc" } });
  res.json({ success: true, data });
}

export async function getByNumber(req: Request, res: Response) {
  const tableNumber = Number(req.params.tableNumber);
  if (!Number.isFinite(tableNumber)) throw new HttpError(400, "Invalid tableNumber");
  const table = await prisma.table.findUnique({ where: { tableNumber } });
  if (!table || !table.isActive) throw new HttpError(404, "Table not found");
  res.json({ success: true, data: table });
}

const CreateSchema = z.object({
  tableNumber: z.number().int().positive(),
  isActive: z.boolean().optional()
});

export async function create(req: Request, res: Response) {
  const body = CreateSchema.parse(req.body);
  const qrCode = await generateTableQr(body.tableNumber);
  const data = await prisma.table.create({ data: { ...body, qrCode } });
  res.status(201).json({ success: true, data });
}

const UpdateSchema = z.object({
  tableNumber: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  regenerateQr: z.boolean().optional()
});

export async function update(req: Request, res: Response) {
  const body = UpdateSchema.parse(req.body);
  const existing = await prisma.table.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, "Table not found");

  const targetTableNumber = body.tableNumber ?? existing.tableNumber;
  const shouldRegenerate = body.regenerateQr || (body.tableNumber !== undefined && body.tableNumber !== existing.tableNumber);

  const updateData: Record<string, unknown> = {};
  if (body.tableNumber !== undefined) updateData.tableNumber = body.tableNumber;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  if (shouldRegenerate) updateData.qrCode = await generateTableQr(targetTableNumber);

  if (Object.keys(updateData).length === 0) throw new HttpError(400, "No updates provided");

  const data = await prisma.table.update({ where: { id: req.params.id }, data: updateData });
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response) {
  await prisma.table.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}
