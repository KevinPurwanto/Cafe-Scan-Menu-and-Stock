import { Request, Response } from "express";
import { prisma } from "../../db";
import { HttpError } from "../../utils/errors";
import ExcelJS from "exceljs";

type PeriodType = "day" | "month" | "year" | "range" | "all";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;

function parseDay(dateStr: string, label: string) {
  if (!DAY_RE.test(dateStr)) {
    throw new HttpError(400, `Parameter '${label}' must be YYYY-MM-DD`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new HttpError(400, `Parameter '${label}' is not a valid date`);
  }
  return { year, month, day };
}

function startOfDayLocal(dateStr: string, label: string) {
  const { year, month, day } = parseDay(dateStr, label);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function endOfDayLocal(dateStr: string, label: string) {
  const { year, month, day } = parseDay(dateStr, label);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function formatDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildRange(period: PeriodType, query: Record<string, any>) {
  if (period === "all") {
    return { startDate: new Date(0), endDate: new Date(), label: "all-time" };
  }

  if (period === "day") {
    const dateStr = query.date?.toString();
    if (!dateStr) {
      throw new HttpError(400, "Parameter 'date' (YYYY-MM-DD) is required for period=day");
    }
    return {
      startDate: startOfDayLocal(dateStr, "date"),
      endDate: endOfDayLocal(dateStr, "date"),
      label: dateStr
    };
  }

  if (period === "month") {
    const monthStr = query.month?.toString();
    if (!monthStr || !MONTH_RE.test(monthStr)) {
      throw new HttpError(400, "Parameter 'month' (YYYY-MM) is required for period=month");
    }
    const [year, month] = monthStr.split("-").map(Number);
    if (month < 1 || month > 12) {
      throw new HttpError(400, "Parameter 'month' must be between 01 and 12");
    }
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate, label: monthStr };
  }

  if (period === "year") {
    const yearStr = query.year?.toString();
    if (!yearStr || !YEAR_RE.test(yearStr)) {
      throw new HttpError(400, "Parameter 'year' (YYYY) is required for period=year");
    }
    const year = Number(yearStr);
    const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    return { startDate, endDate, label: yearStr };
  }

  const start = query.start?.toString();
  const end = query.end?.toString();
  if (!start || !end) {
    throw new HttpError(400, "Parameters 'start' and 'end' (YYYY-MM-DD) are required for period=range");
  }
  const startDate = startOfDayLocal(start, "start");
  const endDate = endOfDayLocal(end, "end");
  if (startDate > endDate) throw new HttpError(400, "Start date must be before end date");
  return {
    startDate,
    endDate,
    label: `${start}_to_${end}`
  };
}

async function getPaidOrdersInRange(startDate: Date, endDate: Date) {
  return prisma.order.findMany({
    where: {
      status: "paid",
      payments: {
        some: {
          status: "success",
          paidAt: { gte: startDate, lte: endDate }
        }
      }
    },
    orderBy: { createdAt: "asc" },
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
      payments: {
        where: {
          status: "success",
          paidAt: { gte: startDate, lte: endDate }
        },
        orderBy: { paidAt: "desc" },
        take: 1
      }
    }
  });
}

// Daily report - sales for a specific date
export async function dailyReport(req: Request, res: Response) {
  const dateStr = req.query.date?.toString();
  if (!dateStr) {
    throw new HttpError(400, "date parameter is required. Example: ?date=2025-12-13");
  }

  const { startDate, endDate } = buildRange("day", { date: dateStr });

  // Get all paid orders for the date (based on payment time)
  const orders = await getPaidOrdersInRange(startDate, endDate);

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
  const endDate = endDateStr ? endOfDayLocal(endDateStr, "end_date") : new Date();
  if (startDateStr && !endDateStr) {
    throw new HttpError(400, "Parameter 'end_date' is required when using 'start_date'");
  }
  if (!startDateStr && endDateStr) {
    throw new HttpError(400, "Parameter 'start_date' is required when using 'end_date'");
  }

  const fallbackStart = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = startDateStr
    ? startOfDayLocal(startDateStr, "start_date")
    : new Date(fallbackStart.getFullYear(), fallbackStart.getMonth(), fallbackStart.getDate(), 0, 0, 0, 0);

  if (startDate > endDate) {
    throw new HttpError(400, "start_date must be before end_date");
  }

  // Get all paid orders in date range (based on payment time)
  const orders = await getPaidOrdersInRange(startDate, endDate);

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
        startDate: formatDateLocal(startDate),
        endDate: formatDateLocal(endDate)
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
  const format = (req.query.format?.toString() ?? "csv").toLowerCase();
  const allowedFormats = ["csv", "xlsx"];
  if (!allowedFormats.includes(format)) {
    throw new HttpError(400, "Invalid format. Use csv|xlsx");
  }
  const { startDate, endDate, label } = buildRange(period, req.query);

  const orders = await getPaidOrdersInRange(startDate, endDate);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const totalOrders = orders.length;

  // Revenue by method
  const revenueByMethod = orders.reduce<Record<string, number>>((acc, order) => {
    const method = order.paymentMethod ?? "unknown";
    acc[method] = (acc[method] ?? 0) + order.totalPrice;
    return acc;
  }, {});

  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const fileBase = `sales-${period}-${label}`.replace(/[^a-zA-Z0-9-_\\.]/g, "_");

  if (format === "csv") {
    const csvEscape = (value: unknown) => {
      const str = String(value ?? "");
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push("Key,Value");
    lines.push(`Period,${csvEscape(period)}`);
    lines.push(`Label,${csvEscape(label)}`);
    lines.push(`Start Date,${csvEscape(startDate.toISOString())}`);
    lines.push(`End Date,${csvEscape(endDate.toISOString())}`);
    lines.push(`Total Orders,${csvEscape(totalOrders)}`);
    lines.push(`Total Revenue,${csvEscape(totalRevenue)}`);
    lines.push(`Average Order Value,${csvEscape(avgOrderValue)}`);
    lines.push("");
    lines.push("Revenue by Payment Method");
    Object.entries(revenueByMethod).forEach(([method, amount]) => {
      lines.push(`${csvEscape(method)},${csvEscape(amount)}`);
    });
    lines.push("");
    lines.push("No,Order ID,Paid At,Table,Payment,Total,Items");

    orders.forEach((order, idx) => {
      const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
      const itemsText = order.items
        .map(i => `${i.quantity}x ${i.menuItem.name} (${i.price})`)
        .join("; ");
      lines.push([
        csvEscape(idx + 1),
        csvEscape(order.id),
        csvEscape(paidAt.toISOString()),
        csvEscape(order.table?.tableNumber ?? "-"),
        csvEscape(order.paymentMethod ?? "-"),
        csvEscape(order.totalPrice),
        csvEscape(itemsText)
      ].join(","));
    });

    const csvContent = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    res.send(csvContent);
    return;
  }

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
  summarySheet.addRow({ key: "Average Order Value", value: avgOrderValue });
  summarySheet.addRow({});
  summarySheet.addRow({ key: "Revenue by Payment Method" });
  Object.entries(revenueByMethod).forEach(([method, amount]) => {
    summarySheet.addRow({ key: method, value: amount });
  });

  const ordersSheet = workbook.addWorksheet("Orders");
  ordersSheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Order ID", key: "orderId", width: 16 },
    { header: "Paid At", key: "paidAt", width: 22 },
    { header: "Table", key: "table", width: 10 },
    { header: "Payment", key: "payment", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Items", key: "items", width: 50 }
  ];

  orders.forEach((order, idx) => {
    const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
    const itemsText = order.items
      .map(i => `${i.quantity}x ${i.menuItem.name} (${i.price})`)
      .join("; ");

    ordersSheet.addRow({
      no: idx + 1,
      orderId: order.id,
      paidAt: paidAt.toISOString(),
      table: order.table?.tableNumber ?? "-",
      payment: order.paymentMethod ?? "-",
      total: order.totalPrice,
      items: itemsText
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}
