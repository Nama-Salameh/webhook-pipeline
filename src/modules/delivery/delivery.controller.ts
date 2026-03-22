import { Request, Response, NextFunction } from "express";
import * as repo from "./delivery.repository.js";
import { boss } from "../../queue/boss.js";
import { NotFoundError } from "../../middleware/error.js";

export const listByPipeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pipelineId = Number(req.params.pipelineId);
    const deliveries = await repo.getByPipeline(pipelineId);
    res.json(deliveries);
  } catch (err) { next(err); }
};

export const retryDelivery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const delivery = await repo.getById(id);
    if (!delivery) throw new NotFoundError("Delivery not found");
    await boss.send("process_event", { eventId: delivery.event_id });
    res.json({ retried: true });
  } catch (err) { next(err); }
};
