import { Request, Response, NextFunction } from "express";
import * as service from "./webhook.service.js";

export const receiveWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pipelineId = Number(req.params.pipelineId);
    const event = await service.ingestWebhook(pipelineId, req.body);
    res.json({ received: true, eventId: event.id });
  } catch (err) { next(err); }
};

export const getEventStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getEventStatus(Number(req.params.id));
    res.json(data);
  } catch (err) { next(err); }
};
