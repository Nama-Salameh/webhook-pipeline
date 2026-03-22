import { Request, Response } from "express";
import * as service from "./pipeline.service.js";

export const create = async (req: Request, res: Response) => {
  try {
    const pipeline = await service.createPipeline(req.body);
    res.status(201).json(pipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const list = async (_: Request, res: Response) => {
  try {
    const pipelines = await service.listPipelines();
    res.json(pipelines);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const remove = async (req: Request, res: Response) => {
  try {
    await service.removePipeline(Number(req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePipeline = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    const updated = await service.updatePipeline(id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const togglePipeline = async (req: Request, res: Response) => {
  try {
    const pipeline = await service.togglePipeline(Number(req.params.id));
    res.json(pipeline);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};
