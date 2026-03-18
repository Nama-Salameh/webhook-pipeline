import { Request, Response } from "express";
import * as repo from "./delivery.repository.js";
import { boss } from "../../queue/boss.js";

export const listByPipeline = async (req: Request, res: Response) => {
  const pipelineId = Number(req.params.pipelineId);
  const deliveries = await repo.getByPipeline(pipelineId);
  res.json(deliveries);
};

export const retryDelivery = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const delivery = await repo.getById(id);
  if (!delivery) {
    return res.status(404).json({ error: "Delivery not found" });
  }

  await boss.send("process_event", {
    eventId: delivery.event_id,
  });

  res.json({ retried: true });
};