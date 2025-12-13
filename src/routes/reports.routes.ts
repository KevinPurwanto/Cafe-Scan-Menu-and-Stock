import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/reports/reports.controller";

const r = Router();

// admin only - all reports require authentication
r.get("/daily", adminAuth, asyncHandler(c.dailyReport));
r.get("/summary", adminAuth, asyncHandler(c.summaryReport));

export default r;
