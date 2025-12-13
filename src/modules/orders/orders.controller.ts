import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

// Create new order (customer via QR code)
const CreateOrderSchema = z.object({
  tableId: z.string().uuid(),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive()
    })
  ).min(1)
});

export async function createOrder(req: Request, res: Response) {
  const body = CreateOrderSchema.parse(req.body);

  // Validate table exists and is active
  const table = await prisma.table.findUnique({
    where: { id: body.tableId }
  });
  if (!table) throw new HttpError(404, "Table not found");
  if (!table.isActive) throw new HttpError(400, "Table is not active");

  // Load menu items to validate and get prices
  const menuIds = body.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } }
  });

  // Validate all menu items
  const menuMap = new Map(menuItems.map(m => [m.id, m]));
  for (const item of body.items) {
    const menuItem = menuMap.get(item.menuItemId);
    if (!menuItem) {
      throw new HttpError(400, `Menu item not found: ${item.menuItemId}`);
    }
    if (!menuItem.isAvailable) {
      throw new HttpError(400, `Menu item not available: ${menuItem.name}`);
    }
    if (menuItem.stock < item.quantity) {
      throw new HttpError(400, `Insufficient stock for: ${menuItem.name}. Available: ${menuItem.stock}`);
    }
  }

  // Calculate total price
  const totalPrice = body.items.reduce((sum, item) => {
    const menuItem = menuMap.get(item.menuItemId)!;
    return sum + (menuItem.price * item.quantity);
  }, 0);

  // Create order with items
  const order = await prisma.order.create({
    data: {
      tableId: body.tableId,
      status: "pending",
      totalPrice,
      items: {
        create: body.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: menuMap.get(item.menuItemId)!.price
        }))
      }
    },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      }
    }
  });

  res.status(201).json({ success: true, data: order });
}

// Get order detail
export async function getOrderDetail(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      table: true,
      items: {
        include: {
          menuItem: {
            include: {
              category: true
            }
          }
        }
      },
      payments: true
    }
  });

  if (!order) throw new HttpError(404, "Order not found");
  res.json({ success: true, data: order });
}

// List orders (admin only)
export async function listOrders(req: Request, res: Response) {
  const status = req.query.status?.toString();
  const tableId = req.query.table_id?.toString();

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(tableId ? { tableId } : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      table: true,
      _count: {
        select: { items: true }
      }
    }
  });

  res.json({ success: true, data: orders });
}

// Pay order (customer)
const PayOrderSchema = z.object({
  method: z.enum(["cash", "qris"])
});

export async function payOrder(req: Request, res: Response) {
  const { method } = PayOrderSchema.parse(req.body);

  // Get order with items
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") {
    throw new HttpError(400, `Order is already ${order.status}`);
  }

  // Use transaction to ensure atomicity:
  // 1. Reduce stock
  // 2. Update order status
  // 3. Create payment record
  const result = await prisma.$transaction(async (tx) => {
    // Re-check stock availability with lock
    const menuIds = order.items.map(i => i.menuItemId);
    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: menuIds } }
    });

    const menuMap = new Map(menuItems.map(m => [m.id, m]));

    // Validate stock again
    for (const item of order.items) {
      const menuItem = menuMap.get(item.menuItemId);
      if (!menuItem) {
        throw new HttpError(400, "Menu item not found");
      }
      if (menuItem.stock < item.quantity) {
        throw new HttpError(400, `Insufficient stock for: ${menuItem.name}`);
      }
    }

    // Reduce stock for each item
    for (const item of order.items) {
      await tx.menuItem.update({
        where: { id: item.menuItemId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    // Update order status
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentMethod: method
      },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true
          }
        }
      }
    });

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        method,
        status: "success",
        paidAt: new Date()
      }
    });

    return { order: updatedOrder, payment };
  });

  res.json({ success: true, data: result });
}

// Cancel order (customer)
export async function cancelOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") {
    throw new HttpError(400, `Cannot cancel order with status: ${order.status}`);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: "cancelled" },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      }
    }
  });

  res.json({ success: true, data: updatedOrder });
}
