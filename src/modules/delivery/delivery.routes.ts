import { Router } from "express";
import * as controller from "./delivery.controller.js";

const router = Router();

router.get("/pipeline/:pipelineId", controller.listByPipeline);
router.post("/:id/retry", controller.retryDelivery);

export default router;