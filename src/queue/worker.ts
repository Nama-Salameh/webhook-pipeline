import { boss } from "./boss.js";
import { getAction } from "../actions/index.js";
import * as eventRepo from "../modules/webhook/webhook.repository.js";
import * as pipelineRepo from "../modules/pipeline/pipeline.repository.js";
import { createDelivery } from "../modules/delivery/delivery.repository.js";
import * as subscriberRepo from "../modules/subscriber/subscriber.repository.js";
import axios from "axios";

export const startWorker = () => {
  boss.work("process_event", async (jobs: any[]) => {
    for (const job of jobs) {
      try {
        const event = await eventRepo.getEventById(job.data.eventId);
        if (!event) throw new Error(`Event not found: ${job.data.eventId}`);

        const pipeline = await pipelineRepo.getPipelineById(event.pipeline_id);
        if (!pipeline) throw new Error(`Pipeline not found: ${event.pipeline_id}`);

        const action = getAction(pipeline.action_type);
        const result = await action.execute(event.payload);

        if (result && result.skipped) {
          console.log(`Event ${event.id} skipped: ${result.reason}`);
          continue;
        }

        const finalPayload = result.payload ?? result;

        console.log(`Event ${event.id} processed by pipeline ${pipeline.id}:`, finalPayload);

        const subscribers = await subscriberRepo.getSubscribersByPipeline(pipeline.id);

        if (subscribers.length > 0) {
          await deliverToSubscribers({ ...event, payload: finalPayload }, subscribers);
        }

      } catch (err) {
        console.error("Worker error:", err);
        throw err;
      }
    }
  });

  console.log("Worker started for process_event jobs");
};


async function deliverToSubscribers(event: any, subscribers: any[]) {
  for (const subscriber of subscribers) {
    let attempt = 1;
    let success = false;

    while (!success && attempt <= 3) {
      try {
        const res = await axios.post(subscriber.target_url, event.payload, { timeout: 5000 });
        await createDelivery(event.id, subscriber.id, "success", res.status, JSON.stringify(res.data), attempt);
        success = true;
        console.log(`Delivered event ${event.id} to subscriber ${subscriber.id}`);
      } catch (err: any) {
        await createDelivery(event.id, subscriber.id, "failed", err.response?.status, err.message, attempt);
        attempt++;
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }

    if (!success) console.error(`Failed to deliver event ${event.id} to subscriber ${subscriber.id}`);
  }
}