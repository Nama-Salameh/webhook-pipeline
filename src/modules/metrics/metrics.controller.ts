import { Request, Response } from "express";
import { getMetrics } from "../../metrics/metrics.js";

export const getSystemMetrics = (_req: Request, res: Response) => {
  res.json(getMetrics());
};
