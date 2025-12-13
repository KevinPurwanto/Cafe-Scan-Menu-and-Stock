import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/orders/orders.controller";

const r = Router();

// customer - public endpoints for QR code ordering
r.post("/", asyncHandler(c.createOrder));                 // create order (pending)
r.get("/:id", asyncHandler(c.getOrderDetail));            // view order detail
r.post("/:id/pay", asyncHandler(c.payOrder));             // mark paid + reduce stock
r.post("/:id/cancel", asyncHandler(c.cancelOrder));       // cancel order

// admin - list and manage orders
r.get("/", adminAuth, asyncHandler(c.listOrders));

export default r;
