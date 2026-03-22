import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import pipelineRoutes from "./modules/pipeline/pipeline.routes.js";
import webhookRoutes from "./modules/webhook/webhook.routes.js";
import subscriberRoutes from "./modules/subscriber/subscriber.routes.js";
import deliveryRoutes from "./modules/delivery/delivery.routes.js";
import eventRoutes from "./modules/webhook/event.routes.js";
import metricsRoutes from "./modules/metrics/metrics.routes.js";
import { requireApiKey } from "./middleware/auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/pipelines", requireApiKey, pipelineRoutes);
app.use("/webhooks/:pipelineId", webhookRoutes);
app.use("/pipelines/:pipelineId/subscribers", requireApiKey, subscriberRoutes);
app.use("/deliveries", requireApiKey, deliveryRoutes);
app.use("/events", requireApiKey, eventRoutes);
app.use("/metrics", requireApiKey, metricsRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});
