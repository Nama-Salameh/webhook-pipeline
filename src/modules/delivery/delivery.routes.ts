import { Router } from "express";
import * as controller from "./delivery.controller.js";

const router = Router();

router.get("/pipeline/:pipelineId", controller.listByPipeline);

export default router;