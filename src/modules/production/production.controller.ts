import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

// Zod validation schemas
const CreateProductionSchema = z.object({
  date: z.coerce.date(),
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  batch: z.number().int().positive(),
  status: z.enum(["Belum diproduksi", "Sedang diproduksi", "Selesai"]).default("Belum diproduksi")
});

const UpdateProductionSchema = z.object({
  date: z.coerce.date().optional(),
  status: z.enum(["Belum diproduksi", "Sedang diproduksi", "Selesai"]).optional()
});

// List all production plans
export async function listProductionPlans(_req: Request, res: Response) {
  const data = await prisma.production.findMany({
    include: {
      menuItem: {
        select: {
          name: true,
          stock: true
        }
      }
    },
    orderBy: {
      date: "desc"
    }
  });

  res.json({ success: true, data });
}

// Create a new production plan
export async function createProductionPlan(req: Request, res: Response) {
  const body = CreateProductionSchema.parse(req.body);

  // Verify that the menu item exists
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: body.menuItemId }
  });

  if (!menuItem) {
    throw new HttpError(404, "Menu item tidak ditemukan");
  }

  let data;
  if (body.status === "Selesai") {
    // If status is immediately Selesai, increment stock in a transaction
    data = await prisma.$transaction(async (tx) => {
      const prod = await tx.production.create({
        data: body
      });

      await tx.menuItem.update({
        where: { id: body.menuItemId },
        data: {
          stock: {
            increment: body.quantity
          }
        }
      });

      return prod;
    });
  } else {
    // Create record normally without adding stock
    data = await prisma.production.create({
      data: body
    });
  }

  res.status(201).json({ success: true, data });
}

// Update a production plan
export async function updateProductionPlan(req: Request, res: Response) {
  const body = UpdateProductionSchema.parse(req.body);
  const { id } = req.params;

  // Retrieve the existing record
  const existing = await prisma.production.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new HttpError(404, "Data produksi tidak ditemukan");
  }

  // Once a row status is "Selesai", it is finalized and cannot be modified
  if (existing.status === "Selesai") {
    throw new HttpError(400, "Data produksi yang sudah selesai/final tidak dapat diedit");
  }

  let data;
  // If transitioning to "Selesai", increment stock and update status in a transaction
  if (body.status === "Selesai") {
    data = await prisma.$transaction(async (tx) => {
      const updated = await tx.production.update({
        where: { id },
        data: {
          date: body.date,
          status: body.status
        }
      });

      await tx.menuItem.update({
        where: { id: existing.menuItemId },
        data: {
          stock: {
            increment: existing.quantity
          }
        }
      });

      return updated;
    });
  } else {
    // Regular update for non-final status (can only update date and status)
    data = await prisma.production.update({
      where: { id },
      data: {
        date: body.date,
        status: body.status
      }
    });
  }

  res.json({ success: true, data });
}

// Delete a production plan
export async function deleteProductionPlan(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.production.findUnique({
    where: { id }
  });

  if (!existing) {
    throw new HttpError(404, "Data produksi tidak ditemukan");
  }

  // Status "Selesai" (final) may be deleted, but stock already added is left untouched
  await prisma.production.delete({
    where: { id }
  });

  res.json({ success: true, message: "Data produksi berhasil dihapus" });
}
