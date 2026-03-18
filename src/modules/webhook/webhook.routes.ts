import { Router } from "express";
import * as controller from "./webhook.controller.js";

const router = Router({ mergeParams: true });

router.post("/", controller.receiveWebhook);

export default router;