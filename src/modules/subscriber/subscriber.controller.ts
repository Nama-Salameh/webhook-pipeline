import { Request, Response, NextFunction } from "express";
import * as service from "./subscriber.service.js";

export const add = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await service.addSubscriber(Number(req.params.pipelineId), req.body));
  } catch (err) { next(err); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.listSubscribers(Number(req.params.pipelineId)));
  } catch (err) { next(err); }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.removeSubscriber(Number(req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
};
