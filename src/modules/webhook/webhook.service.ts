import * as repo from "./webhook.repository.js";
import { boss } from "../../queue/boss.js";
import * as pipelineRepo from "../pipeline/pipeline.repository.js";

export const ingestWebhook = async (pipelineId: number, payload: any) => {
  const pipeline = await pipelineRepo.getPipelineById(pipelineId);
  if (!pipeline) throw new Error("Pipeline not found");

  const event = await repo.createEvent(pipelineId, payload);

  await boss.send("process_event", { eventId: event.id });

  return event;
};

export const getEventStatus = async (eventId: number) => {
  const event = await repo.getEventById(eventId);
  if (!event) throw new Error("Event not found");

  const deliveries = await repo.getDeliveriesByEventId(eventId);

  const successDelivery = deliveries.find(d => d.status === "success");
  const status = successDelivery ? "success" : deliveries.some(d => d.status === "failed") ? "failed" : "pending";

  return {
    event,
    status,
    attempts: deliveries.length,
    deliveries
  };
};