import * as repo from "./pipeline.repository.js";
import { CreatePipelineDTO } from "./pipeline.types.js";

export const createPipeline = async (data: CreatePipelineDTO) => {
  if (!data.name) {
    throw new Error("Pipeline name required");
  }

  const pipeline = await repo.createPipeline(data);

  return {
    ...pipeline,
    webhookUrl: `/webhooks/${pipeline.id}`,
  };
};

export const listPipelines = () => repo.getPipelines();

export const removePipeline = (id: number) =>
  repo.deletePipeline(id);

export const updatePipeline = async (id: number, data: Partial<CreatePipelineDTO>) => {
  if (!data.name && !data.action_type) {
    throw new Error("Nothing to update");
  }

  const updated = await repo.updatePipeline(id, data);
  return updated;
};