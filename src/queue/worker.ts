import { boss } from "./boss.js";
import { getAction } from "../actions/index.js";
import * as eventRepo from "../modules/webhook/webhook.repository.js";
import * as pipelineRepo from "../modules/pipeline/pipeline.repository.js";

export const startWorker = () => {
  boss.work("process_event", async (job: any) => {
    try {
      const event = await eventRepo.getEvent(job.data.eventId);
      if (!event) throw new Error("Event not found");

      const pipeline = await pipelineRepo.getPipelineById(event.pipeline_id);
      if (!pipeline) throw new Error("Pipeline not found");

      const action = getAction(pipeline.action_type);
      const result = await action.execute(event.payload);

      console.log(
        `Event ${event.id} processed by pipeline ${pipeline.id}:`,
        result
      );

    } catch (err) {
      console.error("Worker error:", err);
      throw err;
    }
  });

  console.log("Worker started for process_event jobs");
};