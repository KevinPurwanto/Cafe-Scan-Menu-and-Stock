import { Router } from "express";
const r = Router();
r.get("/", (_req, res) => res.json({ success: true, message: "ok" }));
export default r;
