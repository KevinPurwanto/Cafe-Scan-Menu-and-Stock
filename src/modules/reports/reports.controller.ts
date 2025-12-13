import { Request, Response } from "express";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";

// Daily report - sales for a specific date
export async function dailyReport(req: Request, res: Response) {
  const dateStr = req.query.date?.toString();
  if (!dateStr) {
    throw new HttpError(400, "date parameter is required. Example: ?date=2025-12-13");
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new HttpError(400, "Invalid date format. Use: YYYY-MM-DD");
  }

  // Create date range for the entire day
  const startDate = new Date(`${dateStr}T00:00:00.000Z`);
  const endDate = new Date(`${dateStr}T23:59:59.999Z`);

  // Get all paid orders for the date
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: "paid"
    },
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
      }
    }
  });

  // Calculate totals
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const totalOrders = orders.length;

  // Revenue by payment method
  const revenueByMethod = orders.reduce<Record<string, number>>((acc, order) => {
    const method = order.paymentMethod ?? "unknown";
    acc[method] = (acc[method] ?? 0) + order.totalPrice;
    return acc;
  }, {});

  // Revenue by table
  const revenueByTable = orders.reduce<Record<string, { revenue: number; orders: number }>>((acc, order) => {
    const tableNum = order.table?.tableNumber?.toString() ?? "unknown";
    if (!acc[tableNum]) {
      acc[tableNum] = { revenue: 0, orders: 0 };
    }
    acc[tableNum].revenue += order.totalPrice;
    acc[tableNum].orders += 1;
    return acc;
  }, {});

  // Most popular items
  const itemSales = new Map<string, { name: string; quantity: number; revenue: number; category: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = itemSales.get(item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        itemSales.set(item.menuItemId, {
          name: item.menuItem.name,
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          category: item.menuItem.category?.name ?? "Uncategorized"
        });
      }
    }
  }

  const topItems = Array.from(itemSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      date: dateStr,
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      },
      revenueByMethod,
      revenueByTable,
      topItems
    }
  });
}

// Summary report - overall statistics
export async function summaryReport(req: Request, res: Response) {
  const startDateStr = req.query.start_date?.toString();
  const endDateStr = req.query.end_date?.toString();

  // Default to last 30 days if no dates provided
  const endDate = endDateStr ? new Date(`${endDateStr}T23:59:59.999Z`) : new Date();
  const startDate = startDateStr
    ? new Date(`${startDateStr}T00:00:00.000Z`)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get all paid orders in date range
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: "paid"
    },
    include: {
      items: {
        include: {
          menuItem: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  // Calculate totals
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const totalOrders = orders.length;

  // Revenue by payment method
  const revenueByMethod = orders.reduce<Record<string, { count: number; revenue: number }>>((acc, order) => {
    const method = order.paymentMethod ?? "unknown";
    if (!acc[method]) {
      acc[method] = { count: 0, revenue: 0 };
    }
    acc[method].count += 1;
    acc[method].revenue += order.totalPrice;
    return acc;
  }, {});

  // Revenue by category
  const revenueByCategory = new Map<string, { revenue: number; itemsSold: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const categoryName = item.menuItem.category?.name ?? "Uncategorized";
      const existing = revenueByCategory.get(categoryName);
      if (existing) {
        existing.revenue += item.price * item.quantity;
        existing.itemsSold += item.quantity;
      } else {
        revenueByCategory.set(categoryName, {
          revenue: item.price * item.quantity,
          itemsSold: item.quantity
        });
      }
    }
  }

  // Get total items and categories
  const [totalMenuItems, totalCategories, totalTables] = await Promise.all([
    prisma.menuItem.count(),
    prisma.menuCategory.count(),
    prisma.table.count()
  ]);

  res.json({
    success: true,
    data: {
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
      },
      revenueByMethod,
      revenueByCategory: Object.fromEntries(revenueByCategory),
      inventory: {
        totalMenuItems,
        totalCategories,
        totalTables
      }
    }
  });
}
