import { Router } from "express";
import * as controller from "./pipeline.controller.js";
import subscriberRoutes from "../subscriber/subscriber.routes.js";

const router = Router();

router.post("/", controller.create);
router.get("/", controller.list);
router.delete("/:id", controller.remove);
router.use("/:id/subscribers", subscriberRoutes);

export default router;