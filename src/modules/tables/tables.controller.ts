import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

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
  qrCode: z.string().min(5),
  isActive: z.boolean().optional()
});

export async function create(req: Request, res: Response) {
  const body = CreateSchema.parse(req.body);
  const data = await prisma.table.create({ data: body });
  res.status(201).json({ success: true, data });
}

const UpdateSchema = z.object({
  tableNumber: z.number().int().positive().optional(),
  qrCode: z.string().min(5).optional(),
  isActive: z.boolean().optional()
});

export async function update(req: Request, res: Response) {
  const body = UpdateSchema.parse(req.body);
  const data = await prisma.table.update({ where: { id: req.params.id }, data: body });
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response) {
  await prisma.table.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}
