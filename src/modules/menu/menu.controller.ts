import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

// List all categories
export async function listCategories(_req: Request, res: Response) {
  const data = await prisma.menuCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { items: true }
      }
    }
  });
  res.json({ success: true, data });
}

// List menu items with optional filtering
export async function listItems(req: Request, res: Response) {
  const categoryId = req.query.category_id?.toString();
  const onlyAvailable = req.query.only_available?.toString() !== "false";
  const includeArchived = req.query.include_archived?.toString() === "true";

  const data = await prisma.menuItem.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(onlyAvailable ? { isAvailable: true } : {}),
      ...(includeArchived ? {} : { isArchived: false })
    },
    orderBy: { createdAt: "desc" },
    include: { category: true }
  });

  res.json({ success: true, data });
}

// Create category
const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100)
});

export async function createCategory(req: Request, res: Response) {
  const body = CreateCategorySchema.parse(req.body);
  const data = await prisma.menuCategory.create({ data: body });
  res.status(201).json({ success: true, data });
}

// Update category
const UpdateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional()
});

export async function updateCategory(req: Request, res: Response) {
  const body = UpdateCategorySchema.parse(req.body);
  const data = await prisma.menuCategory.update({
    where: { id: req.params.id },
    data: body
  });
  res.json({ success: true, data });
}

// Remove category
export async function removeCategory(req: Request, res: Response) {
  // Check if category has items
  const category = await prisma.menuCategory.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { items: true } } }
  });

  if (!category) throw new HttpError(404, "Category not found");
  if (category._count.items > 0) {
    throw new HttpError(400, "Cannot delete category with existing items");
  }

  await prisma.menuCategory.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}

// Create menu item
const CreateItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(2).max(150),
  price: z.number().int().min(0),
  stock: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional()
});

export async function createItem(req: Request, res: Response) {
  const body = CreateItemSchema.parse(req.body);

  // Validate category exists if provided
  if (body.categoryId) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: body.categoryId }
    });
    if (!category) throw new HttpError(400, "Category not found");
  }

  const data = await prisma.menuItem.create({
    data: body,
    include: { category: true }
  });
  res.status(201).json({ success: true, data });
}

// Update menu item
const UpdateItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().min(2).max(150).optional(),
  price: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional()
});

export async function updateItem(req: Request, res: Response) {
  const body = UpdateItemSchema.parse(req.body);

  // Validate category exists if provided
  if (body.categoryId) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: body.categoryId }
    });
    if (!category) throw new HttpError(400, "Category not found");
  }

  const data = await prisma.menuItem.update({
    where: { id: req.params.id },
    data: body as any,
    include: { category: true }
  });
  res.json({ success: true, data });
}

// Remove menu item
export async function removeItem(req: Request, res: Response) {
  const item = await prisma.menuItem.findUnique({
    where: { id: req.params.id }
  });

  if (!item) throw new HttpError(404, "Menu item not found");

  await prisma.menuItem.update({
    where: { id: req.params.id },
    data: { isArchived: true, isAvailable: false }
  });
  res.json({ success: true });
}
