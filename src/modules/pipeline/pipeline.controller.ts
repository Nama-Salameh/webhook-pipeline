import { Request, Response, NextFunction } from "express";
import * as service from "./pipeline.service.js";

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pipeline = await service.createPipeline(req.body);
    res.status(201).json(pipeline);
  } catch (err) { next(err); }
};

export const list = async (_: Request, res: Response, next: NextFunction) => {
  try {
    const pipelines = await service.listPipelines();
    res.json(pipelines);
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.removePipeline(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
};

export const updatePipeline = async (req: Request, res: Response, next: NextFunction) => {
  const id = Number(req.params.id);
  try {
    const updated = await service.updatePipeline(id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
};

export const togglePipeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pipeline = await service.togglePipeline(Number(req.params.id));
    res.json(pipeline);
  } catch (err) { next(err); }
};

export const getPipelineMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await service.getPipelineMetrics(Number(req.params.id));
    res.json(metrics);
  } catch (err) { next(err); }
};
