import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/potentialLoss/potentialLoss.controller";

const r = Router();

// Public — dipanggil dari halaman customer (tanpa auth)
r.post("/", asyncHandler(c.recordPotentialLoss));

// Admin only — untuk laporan
r.get("/", adminAuth, asyncHandler(c.getPotentialLosses));

export default r;
