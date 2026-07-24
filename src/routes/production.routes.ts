import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/production/production.controller";

const r = Router();

// Secure all production endpoints with admin authentication
r.get("/", adminAuth, asyncHandler(c.listProductionPlans));
r.post("/", adminAuth, asyncHandler(c.createProductionPlan));
r.patch("/:id", adminAuth, asyncHandler(c.updateProductionPlan));
r.delete("/:id", adminAuth, asyncHandler(c.deleteProductionPlan));

export default r;
