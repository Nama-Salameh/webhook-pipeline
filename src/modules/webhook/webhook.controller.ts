import { Request, Response } from "express";
import { boss } from "../../queue/boss.js";
import * as repo from "./webhook.repository.js";

export const receiveWebhook = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);

  const event = await repo.createEvent(pipelineId, req.body);

  await boss.send("process_event", {
    eventId: event.id,
  });

  res.json({ received: true, eventId: event.id });
};