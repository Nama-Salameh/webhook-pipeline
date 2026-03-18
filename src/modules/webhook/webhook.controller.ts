import { Request, Response } from "express";
import * as service from "./webhook.service.js";

export const receiveWebhook = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);
  const event = await service.ingestWebhook(pipelineId, req.body);
  res.json({ received: true, eventId: event.id });
};