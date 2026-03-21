import { Router } from "express";
import { getEventStatus } from "./webhook.controller.js";

const router = Router();

router.get("/:id/status", getEventStatus);

export default router;
