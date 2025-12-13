import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import * as c from "../modules/tables/tables.controller";

const r = Router();

r.get("/by-number/:tableNumber", c.getByNumber);

r.get("/", adminAuth, c.list);
r.post("/", adminAuth, c.create);
r.patch("/:id", adminAuth, c.update);
r.delete("/:id", adminAuth, c.remove);

export default r;
