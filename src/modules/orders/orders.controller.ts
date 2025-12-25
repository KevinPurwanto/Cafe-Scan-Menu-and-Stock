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
  ).min(1),
  paymentMethod: z.enum(["cash", "qris"]).optional()
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
    if (menuItem.isArchived) {
      throw new HttpError(400, `Menu item archived: ${menuItem.name}`);
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
      paymentMethod: body.paymentMethod ?? null,
      items: {
        create: body.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: menuMap.get(item.menuItemId)!.price,
          menuName: menuMap.get(item.menuItemId)!.name
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

// Validate order (admin) - reserve stock and mark validated
export async function validateOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "pending") {
    throw new HttpError(400, `Cannot validate order with status: ${order.status}`);
  }

  const menuIds = order.items.map(i => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } }
  });
  const menuMap = new Map(menuItems.map(m => [m.id, m]));

  for (const item of order.items) {
    const menuItem = menuMap.get(item.menuItemId);
    if (!menuItem) throw new HttpError(400, "Menu item not found");
    if (menuItem.stock < item.quantity) {
      throw new HttpError(400, `Insufficient stock for: ${menuItem.name}`);
    }
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.menuItem.update({
        where: { id: item.menuItemId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: "validated", validatedAt: new Date() },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true
          }
        }
      }
    });
  });

  res.json({ success: true, data: updatedOrder });
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

// Mark order served (admin)
export async function serveOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      },
      payments: true
    }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "validated" && order.status !== "paid") {
    throw new HttpError(400, `Cannot serve order with status: ${order.status}`);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: "served", servedAt: new Date() },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      },
      payments: true
    }
  });

  res.json({ success: true, data: updatedOrder });
}

// Unserve order (admin)
export async function unserveOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      },
      payments: true
    }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "served") {
    throw new HttpError(400, `Cannot unserve order with status: ${order.status}`);
  }

  const nextStatus = order.payments.length > 0 ? "paid" : "validated";

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: { status: nextStatus, servedAt: null },
    include: {
      table: true,
      items: {
        include: {
          menuItem: true
        }
      },
      payments: true
    }
  });

  res.json({ success: true, data: updatedOrder });
}

// Update order items (admin) - allowed before paid
const UpdateOrderItemsSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive()
    })
  ).min(1)
});

export async function updateOrderItems(req: Request, res: Response) {
  const body = UpdateOrderItemsSchema.parse(req.body);

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status === "paid" || order.status === "served" || order.status === "cancelled") {
    throw new HttpError(400, `Cannot edit order with status: ${order.status}`);
  }

  const menuIds = [...new Set(body.items.map(i => i.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuIds } }
  });

  const menuMap = new Map(menuItems.map(m => [m.id, m]));
  if (menuMap.size !== menuIds.length) {
    throw new HttpError(400, "Menu item not found");
  }

  const oldQtyMap = new Map<string, number>();
  const oldPriceMap = new Map<string, number>();
  const oldNameMap = new Map<string, string>();
  for (const item of order.items) {
    if (!item.menuItemId) continue;
    oldQtyMap.set(item.menuItemId, item.quantity);
    oldPriceMap.set(item.menuItemId, item.price);
    if (item.menuName) {
      oldNameMap.set(item.menuItemId, item.menuName);
    }
  }

  const newQtyMap = new Map<string, number>();
  for (const item of body.items) {
    const current = newQtyMap.get(item.menuItemId) ?? 0;
    newQtyMap.set(item.menuItemId, current + item.quantity);
  }

  for (const [menuItemId, newQty] of newQtyMap.entries()) {
    const menuItem = menuMap.get(menuItemId);
    if (!menuItem) throw new HttpError(400, "Menu item not found");

    const oldQty = oldQtyMap.get(menuItemId) ?? 0;
    const delta = newQty - oldQty;

    if (menuItem.isArchived && delta > 0) {
      throw new HttpError(400, `Menu item archived: ${menuItem.name}`);
    }
    if (!menuItem.isAvailable && delta > 0) {
      throw new HttpError(400, `Menu item not available: ${menuItem.name}`);
    }

    if (order.status === "validated") {
      if (delta > 0 && menuItem.stock < delta) {
        throw new HttpError(400, `Insufficient stock for: ${menuItem.name}`);
      }
    } else {
      if (menuItem.stock < newQty) {
        throw new HttpError(400, `Insufficient stock for: ${menuItem.name}`);
      }
    }
  }

  const totalPrice = Array.from(newQtyMap.entries()).reduce((sum, [menuItemId, qty]) => {
    const menuItem = menuMap.get(menuItemId)!;
    const price = oldPriceMap.get(menuItemId) ?? menuItem.price;
    return sum + (price * qty);
  }, 0);

  const updatedOrder = await prisma.$transaction(async (tx) => {
    if (order.status === "validated") {
      const allMenuIds = new Set<string>([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      for (const menuItemId of allMenuIds) {
        const oldQty = oldQtyMap.get(menuItemId) ?? 0;
        const newQty = newQtyMap.get(menuItemId) ?? 0;
        const delta = newQty - oldQty;
        if (delta > 0) {
          await tx.menuItem.update({
            where: { id: menuItemId },
            data: { stock: { decrement: delta } }
          });
        } else if (delta < 0) {
          await tx.menuItem.update({
            where: { id: menuItemId },
            data: { stock: { increment: Math.abs(delta) } }
          });
        }
      }
    }

    await tx.orderItem.deleteMany({ where: { orderId: order.id } });

    return tx.order.update({
      where: { id: order.id },
      data: {
        totalPrice,
        items: {
          create: Array.from(newQtyMap.entries()).map(([menuItemId, quantity]) => ({
            menuItemId,
            quantity,
            price: oldPriceMap.get(menuItemId) ?? menuMap.get(menuItemId)!.price,
            menuName: oldNameMap.get(menuItemId) ?? menuMap.get(menuItemId)!.name
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
  });

  res.json({ success: true, data: updatedOrder });
}

// Pay order (admin)
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
  if (order.status !== "validated") {
    throw new HttpError(400, `Order is not validated. Current status: ${order.status}`);
  }

  // Use transaction to ensure atomicity:
  // 1. Update order status
  // 2. Create payment record
  const result = await prisma.$transaction(async (tx) => {
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
    where: { id: req.params.id },
    include: { items: true }
  });

  if (!order) throw new HttpError(404, "Order not found");
  if (order.status === "paid") {
    throw new HttpError(400, `Cannot cancel order with status: ${order.status}`);
  }

  if (order.status === "validated") {
    const key = req.header("x-api-key");
    if (!process.env.ADMIN_API_KEY) throw new Error("Missing env: ADMIN_API_KEY");
    if (key !== process.env.ADMIN_API_KEY) throw new HttpError(401, "Unauthorized");

    const updatedOrder = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.menuItem.update({
          where: { id: item.menuItemId },
          data: { stock: { increment: item.quantity } }
        });
      }

      return tx.order.update({
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
    });

    res.json({ success: true, data: updatedOrder });
    return;
  }

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
