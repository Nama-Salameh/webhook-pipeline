import { Router } from "express";
import { getSystemMetrics } from "./metrics.controller.js";

const router = Router();

router.get("/", getSystemMetrics);

export default router;
