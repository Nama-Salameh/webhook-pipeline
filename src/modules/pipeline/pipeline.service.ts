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