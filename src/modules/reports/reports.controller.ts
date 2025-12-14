import { Request, Response } from "express";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";
import ExcelJS from "exceljs";

type PeriodType = "day" | "month" | "year" | "range" | "all";

function buildRange(period: PeriodType, query: Record<string, any>) {
  if (period === "all") {
    return { startDate: new Date(0), endDate: new Date(), label: "all-time" };
  }

  if (period === "day") {
    const dateStr = query.date?.toString();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new HttpError(400, "Parameter 'date' (YYYY-MM-DD) is required for period=day");
    }
    return {
      startDate: new Date(`${dateStr}T00:00:00.000Z`),
      endDate: new Date(`${dateStr}T23:59:59.999Z`),
      label: dateStr
    };
  }

  if (period === "month") {
    const monthStr = query.month?.toString();
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      throw new HttpError(400, "Parameter 'month' (YYYY-MM) is required for period=month");
    }
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { startDate, endDate, label: monthStr };
  }

  if (period === "year") {
    const yearStr = query.year?.toString();
    if (!yearStr || !/^\d{4}$/.test(yearStr)) {
      throw new HttpError(400, "Parameter 'year' (YYYY) is required for period=year");
    }
    const year = Number(yearStr);
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    return { startDate, endDate, label: yearStr };
  }

  // range
  const start = query.start?.toString();
  const end = query.end?.toString();
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new HttpError(400, "Parameters 'start' and 'end' (YYYY-MM-DD) are required for period=range");
  }
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T23:59:59.999Z`);
  if (startDate > endDate) throw new HttpError(400, "Start date must be before end date");
  return {
    startDate,
    endDate,
    label: `${start}_to_${end}`
  };
}

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

// Export sales report to Excel
export async function exportSales(req: Request, res: Response) {
  const period = (req.query.period?.toString() as PeriodType) ?? "day";
  const allowed: PeriodType[] = ["day", "month", "year", "range", "all"];
  if (!allowed.includes(period)) {
    throw new HttpError(400, "Invalid period. Use day|month|year|range|all");
  }
  const { startDate, endDate, label } = buildRange(period, req.query);

  const orders = await prisma.order.findMany({
    where: {
      status: "paid",
      createdAt: { gte: startDate, lte: endDate }
    },
    orderBy: { createdAt: "asc" },
    include: {
      table: true,
      items: {
        include: {
          menuItem: {
            include: { category: true }
          }
        }
      }
    }
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalOrders = orders.length;

  // Revenue by method
  const revenueByMethod = orders.reduce<Record<string, number>>((acc, order) => {
    const method = order.paymentMethod ?? "unknown";
    acc[method] = (acc[method] ?? 0) + order.totalPrice;
    return acc;
  }, {});

  // Build Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cafe Backend";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Key", key: "key", width: 25 },
    { header: "Value", key: "value", width: 30 }
  ];
  summarySheet.addRow({ key: "Period", value: period });
  summarySheet.addRow({ key: "Label", value: label });
  summarySheet.addRow({ key: "Start Date", value: startDate.toISOString() });
  summarySheet.addRow({ key: "End Date", value: endDate.toISOString() });
  summarySheet.addRow({ key: "Total Orders", value: totalOrders });
  summarySheet.addRow({ key: "Total Revenue", value: totalRevenue });
  summarySheet.addRow({ key: "Average Order Value", value: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0 });
  summarySheet.addRow({});
  summarySheet.addRow({ key: "Revenue by Payment Method" });
  Object.entries(revenueByMethod).forEach(([method, amount]) => {
    summarySheet.addRow({ key: method, value: amount });
  });

  const ordersSheet = workbook.addWorksheet("Orders");
  ordersSheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Order ID", key: "orderId", width: 16 },
    { header: "Date", key: "date", width: 22 },
    { header: "Table", key: "table", width: 10 },
    { header: "Payment", key: "payment", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Items", key: "items", width: 50 }
  ];

  orders.forEach((order, idx) => {
    const itemsText = order.items
      .map(i => `${i.quantity}x ${i.menuItem.name} (${i.price})`)
      .join("; ");

    ordersSheet.addRow({
      no: idx + 1,
      orderId: order.id,
      date: order.createdAt.toISOString(),
      table: order.table?.tableNumber ?? "-",
      payment: order.paymentMethod ?? "-",
      total: order.totalPrice,
      items: itemsText
    });
  });

  const fileName = `sales-${period}-${label}.xlsx`.replace(/[^a-zA-Z0-9-_\\.]/g, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
}
