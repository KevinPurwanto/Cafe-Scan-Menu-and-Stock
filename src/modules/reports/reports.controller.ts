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

function getOrdersLimit(rawLimit: unknown) {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.floor(parsed);
}

function sortAndLimitOrders<T extends { paidAt: Date }>(orders: T[], limit: number) {
  const sorted = [...orders].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  return sorted.slice(0, limit);
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
      const itemName = item.menuName ?? "unknown";
      const itemKey = item.menuItemId ?? `name:${itemName}`;
      const existing = itemSales.get(itemKey);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        itemSales.set(itemKey, {
          name: item.menuItem?.name ?? item.menuName ?? "Unknown",
          quantity: item.quantity,
          revenue: item.price * item.quantity,
          category: item.menuItem?.category?.name ?? "Uncategorized"
        });
      }
    }
  }

  const topItems = Array.from(itemSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const ordersDetail = orders.map(order => {
    const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
    return {
      id: order.id,
      tableNumber: order.table?.tableNumber ?? null,
      paymentMethod: order.paymentMethod ?? null,
      totalPrice: order.totalPrice,
      paidAt,
      items: order.items.map(item => ({
        name: item.menuItem?.name ?? item.menuName ?? "Unknown",
        quantity: item.quantity,
        price: item.price
      }))
    };
  });
  const ordersLimit = getOrdersLimit(req.query.orders_limit);
  const limitedOrders = sortAndLimitOrders(ordersDetail, ordersLimit);

  // Potential loss pada hari yang sama
  const dailyPotentialLosses = await prisma.potentialLoss.findMany({
    where: { recordedAt: { gte: startDate, lte: endDate } },
    orderBy: { recordedAt: "desc" }
  });
  const dailyTotalLostQty     = dailyPotentialLosses.reduce((s, r) => s + r.lostQty, 0);
  const dailyTotalRevenueLoss = dailyPotentialLosses.reduce((s, r) => s + r.lostQty * r.price, 0);

  // Aggregate demand: gabung penjualan + potential loss per menu
  const dailyAggMap = new Map<string, { menuName: string; qtySold: number; lostQty: number; revSold: number; revLoss: number }>();
  for (const [, m] of itemSales) {
    dailyAggMap.set(m.name, { menuName: m.name, qtySold: m.quantity, lostQty: 0, revSold: m.revenue, revLoss: 0 });
  }
  for (const pl of dailyPotentialLosses) {
    const ex = dailyAggMap.get(pl.menuName);
    if (ex) { ex.lostQty += pl.lostQty; ex.revLoss += pl.lostQty * pl.price; }
    else dailyAggMap.set(pl.menuName, { menuName: pl.menuName, qtySold: 0, lostQty: pl.lostQty, revSold: 0, revLoss: pl.lostQty * pl.price });
  }
  const dailyAggregate = [...dailyAggMap.values()]
    .filter(a => a.lostQty > 0)
    .sort((a, b) => b.lostQty - a.lostQty)
    .map(a => ({ ...a, totalDemand: a.qtySold + a.lostQty, pctUnmet: a.qtySold + a.lostQty > 0 ? +((a.lostQty / (a.qtySold + a.lostQty)) * 100).toFixed(1) : 0 }));

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
      topItems,
      menuSales: Array.from(itemSales.values()).sort((a, b) => b.quantity - a.quantity).map(m => ({
        name: m.name,
        category: m.category,
        qty: m.quantity,
        revenue: m.revenue,
        avgPrice: m.quantity > 0 ? Math.round(m.revenue / m.quantity) : 0
      })),
      potentialLoss: {
        totalLostQty: dailyTotalLostQty,
        totalRevenueLoss: dailyTotalRevenueLoss,
        records: dailyPotentialLosses
      },
      aggregateDemand: dailyAggregate,
      orders: limitedOrders
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
      const categoryName = item.menuItem?.category?.name ?? "Uncategorized";
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

  const ordersDetail = orders.map(order => {
    const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
    return {
      id: order.id,
      tableNumber: order.table?.tableNumber ?? null,
      paymentMethod: order.paymentMethod ?? null,
      totalPrice: order.totalPrice,
      paidAt,
      items: order.items.map(item => ({
        name: item.menuItem?.name ?? item.menuName ?? "Unknown",
        quantity: item.quantity,
        price: item.price
      }))
    };
  });
  const ordersLimit = getOrdersLimit(req.query.orders_limit);
  const limitedOrders = sortAndLimitOrders(ordersDetail, ordersLimit);

  // Menu sales aggregation (per item)
  const menuSalesMap2 = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const menuName = item.menuItem?.name ?? item.menuName ?? "Unknown";
      const category = item.menuItem?.category?.name ?? "Uncategorized";
      const key = `${menuName}||${category}`;
      const existing = menuSalesMap2.get(key);
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        menuSalesMap2.set(key, { name: menuName, category, qty: item.quantity, revenue: item.price * item.quantity });
      }
    }
  }
  const menuSalesList2 = [...menuSalesMap2.values()]
    .sort((a, b) => b.qty - a.qty)
    .map(m => ({ ...m, avgPrice: m.qty > 0 ? Math.round(m.revenue / m.qty) : 0 }));

  // Potential loss dalam rentang yang sama
  const summaryPotentialLosses = await prisma.potentialLoss.findMany({
    where: { recordedAt: { gte: startDate, lte: endDate } },
    orderBy: { recordedAt: "desc" }
  });
  const summaryTotalLostQty     = summaryPotentialLosses.reduce((s, r) => s + r.lostQty, 0);
  const summaryTotalRevenueLoss = summaryPotentialLosses.reduce((s, r) => s + r.lostQty * r.price, 0);

  // Aggregate demand: gabung penjualan + potential loss per menu
  const summaryAggMap = new Map<string, { menuName: string; qtySold: number; lostQty: number; revSold: number; revLoss: number }>();
  for (const m of menuSalesList2) {
    summaryAggMap.set(m.name, { menuName: m.name, qtySold: m.qty, lostQty: 0, revSold: m.revenue, revLoss: 0 });
  }
  for (const pl of summaryPotentialLosses) {
    const ex = summaryAggMap.get(pl.menuName);
    if (ex) { ex.lostQty += pl.lostQty; ex.revLoss += pl.lostQty * pl.price; }
    else summaryAggMap.set(pl.menuName, { menuName: pl.menuName, qtySold: 0, lostQty: pl.lostQty, revSold: 0, revLoss: pl.lostQty * pl.price });
  }
  const summaryAggregate = [...summaryAggMap.values()]
    .filter(a => a.lostQty > 0)
    .sort((a, b) => b.lostQty - a.lostQty)
    .map(a => ({ ...a, totalDemand: a.qtySold + a.lostQty, pctUnmet: a.qtySold + a.lostQty > 0 ? +((a.lostQty / (a.qtySold + a.lostQty)) * 100).toFixed(1) : 0 }));

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
      menuSales: menuSalesList2,
      potentialLoss: {
        totalLostQty: summaryTotalLostQty,
        totalRevenueLoss: summaryTotalRevenueLoss,
        records: summaryPotentialLosses
      },
      aggregateDemand: summaryAggregate,
      inventory: {
        totalMenuItems,
        totalCategories,
        totalTables
      },
      orders: limitedOrders
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

  // Ambil potential loss dalam rentang yang sama
  const potentialLosses = await prisma.potentialLoss.findMany({
    where: { recordedAt: { gte: startDate, lte: endDate } },
    orderBy: { recordedAt: "desc" }
  });
  const totalLostQty      = potentialLosses.reduce((s, r) => s + r.lostQty, 0);
  const totalRevenueLoss  = potentialLosses.reduce((s, r) => s + r.lostQty * r.price, 0);

  if (format === "csv") {
    const csvEscape = (value: unknown) => {
      const str = String(value ?? "");
      if (/["\,\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Agregasi menu terjual
    const menuSalesMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    orders.forEach(order => {
      order.items.forEach(item => {
        const menuName = item.menuItem?.name ?? item.menuName ?? "Unknown";
        const category = item.menuItem?.category?.name ?? "-";
        const key = `${menuName}||${category}`;
        const existing = menuSalesMap.get(key);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += item.price * item.quantity;
        } else {
          menuSalesMap.set(key, { name: menuName, category, qty: item.quantity, revenue: item.price * item.quantity });
        }
      });
    });
    const menuSalesList = [...menuSalesMap.values()].sort((a, b) => b.qty - a.qty);

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
    lines.push("--- MENU TERJUAL ---");
    lines.push("No,Nama Menu,Kategori,Qty Terjual,Total Revenue,Rata-rata Harga");
    menuSalesList.forEach((m, idx) => {
      const avgPrice = m.qty > 0 ? Math.round(m.revenue / m.qty) : 0;
      lines.push([
        csvEscape(idx + 1),
        csvEscape(m.name),
        csvEscape(m.category),
        csvEscape(m.qty),
        csvEscape(m.revenue),
        csvEscape(avgPrice)
      ].join(","));
    });
    lines.push("");
    lines.push("--- POTENTIAL LOSS ---");
    lines.push(`Total Qty Hilang,${csvEscape(totalLostQty)}`);
    lines.push(`Estimasi Revenue Hilang,${csvEscape(totalRevenueLoss)}`);
    lines.push("");
    lines.push("No,Waktu,Nama Menu,Meja,Diminta,Stok,Qty Hilang,Est. Revenue Hilang");
    potentialLosses.forEach((pl, idx) => {
      lines.push([
        csvEscape(idx + 1),
        csvEscape(pl.recordedAt.toISOString()),
        csvEscape(pl.menuName),
        csvEscape(pl.tableNumber ?? "-"),
        csvEscape(pl.requestedQty),
        csvEscape(pl.stockAvailable),
        csvEscape(pl.lostQty),
        csvEscape(pl.lostQty * pl.price)
      ].join(","));
    });
    lines.push("");
    lines.push("--- DETAIL ORDER ---");
    lines.push("No,Order ID,Paid At,Table,Payment,Total,Items");

    orders.forEach((order, idx) => {
      const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
      const itemsText = order.items
        .map(i => `${i.quantity}x ${(i.menuItem?.name ?? i.menuName ?? "Unknown")} (${i.price})`)
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

  // helper: thin border untuk satu cell
  const thinBorder: Partial<ExcelJS.Borders> = {
    top:    { style: "thin", color: { argb: "FFD1D5DB" } },
    left:   { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right:  { style: "thin", color: { argb: "FFD1D5DB" } }
  };
  const applyRowBorder = (row: ExcelJS.Row, colCount: number) => {
    for (let c = 1; c <= colCount; c++) {
      row.getCell(c).border = thinBorder;
    }
  };
  const rupiahFmt = '"Rp "#,##0';

  // ── Sheet 1: Summary ──────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { key: "key",   width: 30 },
    { key: "value", width: 32 }
  ];

  // Judul besar
  summarySheet.mergeCells("A1:B1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = `📊 Sales Report — ${label}`;
  titleCell.font  = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(1).height = 32;

  // Sub-judul periode
  summarySheet.mergeCells("A2:B2");
  const subCell = summarySheet.getCell("A2");
  subCell.value = `${startDate.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} s/d ${endDate.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`;
  subCell.font  = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  subCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  subCell.alignment = { horizontal: "center" };
  summarySheet.addRow([]);

  // Helper: section header
  const addSectionHeader = (sheet: ExcelJS.Worksheet, label: string) => {
    sheet.mergeCells(`A${sheet.rowCount + 1}:B${sheet.rowCount + 1}`);
    const r = sheet.lastRow!;
    r.getCell(1).value = label;
    r.getCell(1).font  = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    r.getCell(1).fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    r.height = 22;
  };

  // Helper: data row dengan border + optional format
  const addSummaryRow = (
    sheet: ExcelJS.Worksheet,
    key: string,
    value: string | number,
    isHighlight = false,
    numFmt?: string
  ) => {
    const r = sheet.addRow({ key, value });
    r.getCell(1).font = { bold: isHighlight, color: { argb: "FF374151" } };
    r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: isHighlight ? "FFDBEAFE" : "FFFFFFFF" } };
    r.getCell(2).font = { bold: isHighlight, color: { argb: isHighlight ? "FF1E40AF" : "FF111827" } };
    r.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: isHighlight ? "FFDBEAFE" : "FFFFFFFF" } };
    if (numFmt) r.getCell(2).numFmt = numFmt;
    applyRowBorder(r, 2);
  };

  addSectionHeader(summarySheet, "Informasi Periode");
  addSummaryRow(summarySheet, "Periode", period);
  addSummaryRow(summarySheet, "Label", label);
  addSummaryRow(summarySheet, "Tanggal Mulai", startDate.toISOString());
  addSummaryRow(summarySheet, "Tanggal Selesai", endDate.toISOString());

  summarySheet.addRow([]);

  addSectionHeader(summarySheet, "Ringkasan Penjualan");
  addSummaryRow(summarySheet, "Total Pesanan", totalOrders, true);
  addSummaryRow(summarySheet, "Total Revenue", totalRevenue, true, rupiahFmt);
  addSummaryRow(summarySheet, "Rata-rata Nilai Order", avgOrderValue, false, rupiahFmt);

  summarySheet.addRow([]);

  addSectionHeader(summarySheet, "Revenue per Metode Bayar");
  Object.entries(revenueByMethod).forEach(([method, amount]) => {
    addSummaryRow(summarySheet, method, amount, false, rupiahFmt);
  });

  summarySheet.views = [{ state: "frozen", ySplit: 3 }];

  // ── Sheet 2: Menu Sales (Agregasi per menu) ───────────────────
  const menuSalesMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
  orders.forEach(order => {
    order.items.forEach(item => {
      const menuName = item.menuItem?.name ?? item.menuName ?? "Unknown";
      const category = item.menuItem?.category?.name ?? "-";
      const key = `${menuName}||${category}`;
      const existing = menuSalesMap.get(key);
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.price * item.quantity;
      } else {
        menuSalesMap.set(key, { name: menuName, category, qty: item.quantity, revenue: item.price * item.quantity });
      }
    });
  });
  const menuSalesList = [...menuSalesMap.values()].sort((a, b) => b.qty - a.qty);

  const menuSheet = workbook.addWorksheet("Menu Sales");
  menuSheet.columns = [
    { header: "No",                   key: "no",       width: 6  },
    { header: "Nama Menu",            key: "name",     width: 28 },
    { header: "Kategori",             key: "category", width: 18 },
    { header: "Qty Terjual",          key: "qty",      width: 14 },
    { header: "Total Revenue (Rp)",   key: "revenue",  width: 22 },
    { header: "Rata-rata Harga (Rp)", key: "avgPrice", width: 24 }
  ];
  const menuHeader = menuSheet.getRow(1);
  menuHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  menuHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  menuHeader.height = 24;
  applyRowBorder(menuHeader, 6);

  menuSalesList.forEach((m, idx) => {
    const avgPrice = m.qty > 0 ? Math.round(m.revenue / m.qty) : 0;
    const row = menuSheet.addRow({
      no: idx + 1,
      name: m.name,
      category: m.category,
      qty: m.qty,
      revenue: m.revenue,
      avgPrice
    });
    row.getCell("revenue").numFmt  = rupiahFmt;
    row.getCell("avgPrice").numFmt = rupiahFmt;
    row.getCell("qty").alignment   = { horizontal: "center" };
    row.getCell("no").alignment    = { horizontal: "center" };
    const bg = idx % 2 === 1 ? "FFF0F4FF" : "FFFFFFFF";
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      row.getCell(c).border = thinBorder;
    }
  });

  menuSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet 3: Orders (Detail) ──────────────────────────────────
  const ordersSheet = workbook.addWorksheet("Orders");
  ordersSheet.columns = [
    { header: "No",         key: "no",       width: 6  },
    { header: "Order ID",   key: "orderId",  width: 20 },
    { header: "Paid At",    key: "paidAt",   width: 22 },
    { header: "Meja",       key: "table",    width: 10 },
    { header: "Pembayaran", key: "payment",  width: 14 },
    { header: "Total (Rp)", key: "total",    width: 18 },
    { header: "Item Pesanan", key: "items",  width: 55 }
  ];
  const ordersHeader = ordersSheet.getRow(1);
  ordersHeader.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  ordersHeader.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  ordersHeader.height = 24;
  applyRowBorder(ordersHeader, 7);

  orders.forEach((order, idx) => {
    const paidAt = order.payments?.[0]?.paidAt ?? order.createdAt;
    const itemsText = order.items
      .map(i => `${i.quantity}x ${(i.menuItem?.name ?? i.menuName ?? "Unknown")} (${i.price})`)
      .join("; ");

    const row = ordersSheet.addRow({
      no:      idx + 1,
      orderId: order.id,
      paidAt:  paidAt.toISOString(),
      table:   order.table?.tableNumber ?? "-",
      payment: order.paymentMethod ?? "-",
      total:   order.totalPrice,
      items:   itemsText
    });

    row.getCell("total").numFmt   = rupiahFmt;
    row.getCell("no").alignment   = { horizontal: "center" };
    row.getCell("table").alignment = { horizontal: "center" };

    const bg = idx % 2 === 1 ? "FFF0FDF4" : "FFFFFFFF";
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      row.getCell(c).border = thinBorder;
    }
  });

  ordersSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet 4: Potential Loss ───────────────────────────────────
  const plSheet = workbook.addWorksheet("Potential Loss");
  plSheet.columns = [
    { header: "No",                      key: "no",          width: 6  },
    { header: "Waktu",                   key: "recordedAt",  width: 22 },
    { header: "Nama Menu",               key: "menuName",    width: 28 },
    { header: "Meja",                    key: "tableNum",    width: 10 },
    { header: "Qty Diminta",             key: "requested",   width: 14 },
    { header: "Stok Tersedia",           key: "stock",       width: 14 },
    { header: "Qty Hilang",              key: "lost",        width: 14 },
    { header: "Est. Revenue Hilang (Rp)",key: "revLoss",     width: 26 }
  ];
  const plHeader = plSheet.getRow(1);
  plHeader.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
  plHeader.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  plHeader.height = 24;
  applyRowBorder(plHeader, 8);

  potentialLosses.forEach((pl, idx) => {
    const row = plSheet.addRow({
      no:         idx + 1,
      recordedAt: pl.recordedAt.toISOString(),
      menuName:   pl.menuName,
      tableNum:   pl.tableNumber ?? "-",
      requested:  pl.requestedQty,
      stock:      pl.stockAvailable,
      lost:       pl.lostQty,
      revLoss:    pl.lostQty * pl.price
    });
    row.getCell("revLoss").numFmt  = rupiahFmt;
    row.getCell("no").alignment    = { horizontal: "center" };
    row.getCell("tableNum").alignment = { horizontal: "center" };
    row.getCell("requested").alignment = { horizontal: "center" };
    row.getCell("stock").alignment  = { horizontal: "center" };
    row.getCell("lost").alignment   = { horizontal: "center" };
    const bg = idx % 2 === 1 ? "FFFFF1F2" : "FFFFFFFF";
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      row.getCell(c).border = thinBorder;
    }
  });

  // Baris total potential loss
  plSheet.addRow([]);
  const plTotalRow = plSheet.addRow({
    no:       "",
    recordedAt: "TOTAL",
    menuName:  "",
    tableNum:  "",
    requested: "",
    stock:     "",
    lost:      totalLostQty,
    revLoss:   totalRevenueLoss
  });
  plTotalRow.getCell(2).font = { bold: true };
  plTotalRow.getCell(7).font = { bold: true };
  plTotalRow.getCell(8).font = { bold: true };
  plTotalRow.getCell(8).numFmt = rupiahFmt;
  plTotalRow.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };
  plTotalRow.getCell(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFECACA" } };

  plSheet.views = [{ state: "frozen", ySplit: 1 }];

  // ── Sheet 5: Aggregate Demand Loss ───────────────────────────────────────
  // Gabungkan: qty terjual (OrderItem) + qty diblok (PotentialLoss) per menu item
  // → hasilkan: total demand, unmet demand, estimated revenue loss
  const aggMap = new Map<string, {
    menuName: string;
    qtySold:  number;
    lostQty:  number;
    revSold:  number;
    revLoss:  number;
  }>();

  // Isi dari penjualan aktual
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.menuItem?.name ?? item.menuName ?? "Unknown";
      const existing = aggMap.get(key);
      if (existing) {
        existing.qtySold += item.quantity;
        existing.revSold += item.price * item.quantity;
      } else {
        aggMap.set(key, { menuName: key, qtySold: item.quantity, lostQty: 0, revSold: item.price * item.quantity, revLoss: 0 });
      }
    }
  }

  // Tambahkan data potential loss (mungkin ada menu yang 100% diblok, belum pernah terjual)
  for (const pl of potentialLosses) {
    const key = pl.menuName;
    const existing = aggMap.get(key);
    if (existing) {
      existing.lostQty += pl.lostQty;
      existing.revLoss += pl.lostQty * pl.price;
    } else {
      aggMap.set(key, { menuName: key, qtySold: 0, lostQty: pl.lostQty, revSold: 0, revLoss: pl.lostQty * pl.price });
    }
  }

  // Sort: unmet demand terbesar dahulu
  const aggList = [...aggMap.values()]
    .filter(a => a.lostQty > 0) // hanya tampilkan yang ada unmet demand
    .sort((a, b) => b.lostQty - a.qtySold - (a.lostQty - a.qtySold));

  const aggSheet = workbook.addWorksheet("Aggregate Demand");
  aggSheet.columns = [
    { header: "No",                         key: "no",          width: 6  },
    { header: "Nama Menu",                  key: "menuName",    width: 28 },
    { header: "Qty Terjual",                key: "qtySold",     width: 14 },
    { header: "Qty Diblok (Unmet)",         key: "lostQty",     width: 18 },
    { header: "Total Demand",               key: "totalDemand", width: 14 },
    { header: "Revenue Terjual (Rp)",       key: "revSold",     width: 24 },
    { header: "Est. Revenue Hilang (Rp)",   key: "revLoss",     width: 26 },
    { header: "% Demand Tidak Terpenuhi",   key: "pctUnmet",    width: 26 }
  ];

  const aggHeader = aggSheet.getRow(1);
  aggHeader.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
  aggHeader.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  aggHeader.height = 24;
  applyRowBorder(aggHeader, 8);

  let aggTotalSold = 0, aggTotalLost = 0, aggTotalRevSold = 0, aggTotalRevLoss = 0;

  aggList.forEach((a, idx) => {
    const totalDemand = a.qtySold + a.lostQty;
    const pctUnmet    = totalDemand > 0 ? ((a.lostQty / totalDemand) * 100).toFixed(1) + "%" : "0%";
    aggTotalSold    += a.qtySold;
    aggTotalLost    += a.lostQty;
    aggTotalRevSold += a.revSold;
    aggTotalRevLoss += a.revLoss;

    const row = aggSheet.addRow({
      no:          idx + 1,
      menuName:    a.menuName,
      qtySold:     a.qtySold,
      lostQty:     a.lostQty,
      totalDemand,
      revSold:     a.revSold,
      revLoss:     a.revLoss,
      pctUnmet
    });
    row.getCell("revSold").numFmt   = rupiahFmt;
    row.getCell("revLoss").numFmt   = rupiahFmt;
    row.getCell("no").alignment     = { horizontal: "center" };
    row.getCell("qtySold").alignment     = { horizontal: "center" };
    row.getCell("lostQty").alignment     = { horizontal: "center" };
    row.getCell("totalDemand").alignment = { horizontal: "center" };
    row.getCell("pctUnmet").alignment    = { horizontal: "center" };
    const bg = idx % 2 === 1 ? "FFEDE9FE" : "FFFFFFFF";
    for (let c = 1; c <= 8; c++) {
      row.getCell(c).fill   = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      row.getCell(c).border = thinBorder;
    }
    // Highlight baris dengan unmet demand > 50%
    if (a.lostQty > a.qtySold) {
      row.getCell("pctUnmet").font = { bold: true, color: { argb: "FFB91C1C" } };
    }
  });

  // Baris total
  aggSheet.addRow([]);
  const aggTotalRow = aggSheet.addRow({
    no:          "",
    menuName:    "TOTAL",
    qtySold:     aggTotalSold,
    lostQty:     aggTotalLost,
    totalDemand: aggTotalSold + aggTotalLost,
    revSold:     aggTotalRevSold,
    revLoss:     aggTotalRevLoss,
    pctUnmet:    (aggTotalSold + aggTotalLost) > 0
      ? (((aggTotalLost / (aggTotalSold + aggTotalLost)) * 100).toFixed(1) + "%")
      : "0%"
  });
  [2,3,4,5,6,7,8].forEach(c => {
    aggTotalRow.getCell(c).font   = { bold: true };
    aggTotalRow.getCell(c).fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDD6FE" } };
    aggTotalRow.getCell(c).border = thinBorder;
  });
  aggTotalRow.getCell("revSold").numFmt = rupiahFmt;
  aggTotalRow.getCell("revLoss").numFmt = rupiahFmt;

  if (aggList.length === 0) {
    aggSheet.addRow([]);
    aggSheet.addRow({ no: "", menuName: "Tidak ada unmet demand pada periode ini.", qtySold: "", lostQty: "", totalDemand: "", revSold: "", revLoss: "", pctUnmet: "" });
  }

  aggSheet.views = [{ state: "frozen", ySplit: 1 }];

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

