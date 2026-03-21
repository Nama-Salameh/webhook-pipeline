import { Router } from "express";
import * as controller from "./pipeline.controller.js";

const router = Router();

router.post("/", controller.create);
router.get("/", controller.list);
router.delete("/:id", controller.remove);

export default router;