import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { asyncHandler } from "../utils/errors";
import * as c from "../modules/menu/menu.controller";

const r = Router();

// public - customer can view menu
r.get("/categories", asyncHandler(c.listCategories));
r.get("/items", asyncHandler(c.listItems));

// admin - manage categories and items
r.post("/categories", adminAuth, asyncHandler(c.createCategory));
r.patch("/categories/:id", adminAuth, asyncHandler(c.updateCategory));
r.delete("/categories/:id", adminAuth, asyncHandler(c.removeCategory));

r.post("/items", adminAuth, asyncHandler(c.createItem));
r.patch("/items/:id", adminAuth, asyncHandler(c.updateItem));
r.delete("/items/:id", adminAuth, asyncHandler(c.removeItem));

export default r;
