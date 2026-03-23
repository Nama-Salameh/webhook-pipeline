import * as repo from "./webhook.repository.js";
import { boss } from "../../queue/boss.js";
import * as pipelineRepo from "../pipeline/pipeline.repository.js";
import { NotFoundError, ValidationError } from "../../middleware/error.js";

export const ingestWebhook = async (pipelineId: number, payload: any) => {
  const pipeline = await pipelineRepo.getPipelineById(pipelineId);

  if (!pipeline) throw new NotFoundError("Pipeline not found");
  if (!pipeline.enabled) throw new ValidationError("Pipeline is disabled");

  const event = await repo.createEvent(pipelineId, payload);
  await boss.send("process_event", { eventId: event.id });
  return event;
};

export const getEventStatus = async (eventId: number) => {
  const event = await repo.getEventById(eventId);
  if (!event) throw new NotFoundError("Event not found");

  const deliveries = await repo.getDeliveriesByEventId(eventId);

  const subIds = [...new Set(deliveries.map((d: any) => d.subscriber_id))];
  const subStatuses = subIds.map(sid => {
    const subDeliveries = deliveries
      .filter((d: any) => d.subscriber_id === sid)
      .sort((a: any, b: any) => new Date(a.last_attempt).getTime() - new Date(b.last_attempt).getTime());
    return subDeliveries[subDeliveries.length - 1]?.status ?? "pending";
  });

  const status =
    subStatuses.every(s => s === "success") ? "success" :
    subStatuses.every(s => s === "failed")  ? "failed"  : "partial";

  return {
    event,
    status,
    attempts: deliveries.length,
    deliveries
  };
};