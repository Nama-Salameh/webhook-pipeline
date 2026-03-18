import * as repo from "./subscriber.repository.js";
import { CreateSubscriberDTO, Subscriber } from "./subscriber.types.js";

export const addSubscriber = async (
  pipelineId: number,
  dto: CreateSubscriberDTO
): Promise<Subscriber> => {
  return repo.createSubscriber(pipelineId, dto);
};

export const listSubscribers = async (pipelineId: number) =>
  repo.getSubscribersByPipeline(pipelineId);

export const removeSubscriber = async (id: number) =>
  repo.deleteSubscriber(id);