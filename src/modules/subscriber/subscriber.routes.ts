import { Router } from "express";
import * as controller from "./subscriber.controller.js";

const router = Router({ mergeParams: true });

router.post("/", controller.add);
router.get("/", controller.list);
router.delete("/:id", controller.remove);

export default router;