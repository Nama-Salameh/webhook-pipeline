import { Request, Response } from "express";
import * as service from "./webhook.service.js";

export const receiveWebhook = async (req: Request, res: Response) => {
  try {
    const pipelineId = Number(req.params.pipelineId);
    const event = await service.ingestWebhook(pipelineId, req.body);
    res.json({ received: true, eventId: event.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getEventStatus = async (req: Request, res: Response) => {
  const eventId = Number(req.params.id);
  try {
    const data = await service.getEventStatus(eventId);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
};