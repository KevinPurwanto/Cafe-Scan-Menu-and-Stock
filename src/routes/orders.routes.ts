import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { staffAuth } from "../middleware/staffAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/orders/orders.controller";

const r = Router();

// customer - public endpoints for QR code ordering
r.post("/", asyncHandler(c.createOrder));                 // create order (pending)
r.get("/:id", asyncHandler(c.getOrderDetail));            // view order detail
r.post("/:id/cancel", asyncHandler(c.cancelOrder));       // cancel order

// admin - list and manage orders
r.get("/", staffAuth, asyncHandler(c.listOrders));
r.post("/:id/validate", adminAuth, asyncHandler(c.validateOrder));
r.patch("/:id/items", adminAuth, asyncHandler(c.updateOrderItems));
r.post("/:id/pay", adminAuth, asyncHandler(c.payOrder));
r.post("/:id/serve", staffAuth, asyncHandler(c.serveOrder));
r.post("/:id/unserve", staffAuth, asyncHandler(c.unserveOrder));

export default r;
