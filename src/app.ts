import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import pipelineRoutes from "./modules/pipeline/pipeline.routes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use("/pipelines", pipelineRoutes);

app.get("/health", (_: Request, res: Response) => {
  res.send("ok");
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message });
});