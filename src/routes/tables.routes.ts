import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/tables/tables.controller";

const r = Router();

// public - get table by number (for QR code scanning)
r.get("/by-number/:tableNumber", asyncHandler(c.getByNumber));

// admin - manage tables
r.get("/", adminAuth, asyncHandler(c.list));
r.post("/", adminAuth, asyncHandler(c.create));
r.patch("/:id", adminAuth, asyncHandler(c.update));
r.delete("/:id", adminAuth, asyncHandler(c.remove));

export default r;
