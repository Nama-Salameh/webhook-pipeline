import { Request, Response } from "express";
import * as service from "./subscriber.service.js";

export const add = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);
  const subscriber = await service.addSubscriber(pipelineId, req.body);
  res.status(201).json(subscriber);
};

export const list = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);
  const subscribers = await service.listSubscribers(pipelineId);
  res.json(subscribers);
};

export const remove = async (req: Request, res: Response) => {
  await service.removeSubscriber(Number(req.params.id));
  res.status(204).send();
};