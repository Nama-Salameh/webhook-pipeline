import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import pipelineRoutes from "./modules/pipeline/pipeline.routes.js";
import webhookRoutes from "./modules/webhook/webhook.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/pipelines", pipelineRoutes);
app.use("/webhooks/:pipelineId", webhookRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
});
