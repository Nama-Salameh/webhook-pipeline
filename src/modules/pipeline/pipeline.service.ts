import * as repo from "./pipeline.repository.js";
import { CreatePipelineDTO } from "./pipeline.types.js";
import { NotFoundError, ValidationError } from "../../middleware/error.js";
import { getAction } from "../../actions/index.js";

export const createPipeline = async (data: CreatePipelineDTO) => {
  if (!data.name) throw new ValidationError("Pipeline name required");
  getAction(data.action_type);

  const pipeline = await repo.createPipeline(data);
  return { ...pipeline, webhookUrl: `/webhooks/${pipeline.id}` };
};

export const listPipelines = () => repo.getPipelines();

export const removePipeline = (id: number) =>
  repo.deletePipeline(id);

export const updatePipeline = async (id: number, data: Partial<CreatePipelineDTO>) => {
  if (!data.name && !data.action_type) throw new ValidationError("Nothing to update");

  const updated = await repo.updatePipeline(id, data);
  return updated;
};

export const togglePipeline = async (id: number) => {
  const pipeline = await repo.getPipelineById(id);
  if (!pipeline) throw new NotFoundError("Pipeline not found");
  return repo.togglePipeline(id, !pipeline.enabled);
};

export const getPipelineMetrics = (id: number) => repo.getPipelineMetrics(id);
