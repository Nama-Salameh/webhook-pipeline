import { Request, Response } from "express";
import * as repo from "./delivery.repository.js";

export const listByPipeline = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);
  const deliveries = await repo.getByPipeline(pipelineId);
  res.json(deliveries);
};