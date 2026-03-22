import { Router } from "express";
import * as controller from "./pipeline.controller.js";

const router = Router();

router.post("/", controller.create);
router.put("/:id", controller.updatePipeline);
router.patch("/:id/toggle", controller.togglePipeline);
router.get("/:id/metrics", controller.getPipelineMetrics);
router.get("/", controller.list);
router.delete("/:id", controller.remove);

export default router;