import { boss } from "./boss.js";
import { getAction } from "../actions/index.js";
import * as eventRepo from "../modules/webhook/webhook.repository.js";
import * as pipelineRepo from "../modules/pipeline/pipeline.repository.js";
import { createDelivery } from "../modules/delivery/delivery.repository.js";
import * as subscriberRepo from "../modules/subscriber/subscriber.repository.js";
import axios from "axios";
import { checkRateLimit } from "../utils/rateLimiter.js";

export const startWorker = () => {
  boss.work("process_event", async (jobs: any[]) => {
    for (const job of jobs) {
      try {
        const event = await eventRepo.getEventById(job.data.eventId);
        if (!event) throw new Error(`Event not found: ${job.data.eventId}`);

        const pipeline = await pipelineRepo.getPipelineById(event.pipeline_id);
        if (!pipeline) throw new Error(`Pipeline not found: ${event.pipeline_id}`);
        if (!pipeline.enabled) {
          console.log(`Pipeline ${pipeline.id} is disabled, skipping event ${event.id}`);
          continue;
        }

        const action = getAction(pipeline.action_type, pipeline.action_options ?? {});
        const result = await action.execute(event.payload);

        if (result && result.skipped) {
          console.log(`Event ${event.id} skipped: ${result.reason}`);
          continue;
        }

        const finalPayload = result.payload ?? result;

        const subscribers = await subscriberRepo.getSubscribersByPipeline(pipeline.id);
        if (subscribers.length > 0) {
          await deliverToSubscribers(
            { ...event, payload: finalPayload },
            subscribers,
            pipeline
          );
        }

      } catch (err) {
        console.error("Worker error:", err);
        throw err;
      }
    }
  });

  console.log("Worker started for process_event jobs");
};

async function deliverToSubscribers(event: any, subscribers: any[], pipeline: any) {
  const rateLimit = pipeline.action_options?.rate_limit;
  const maxRetries = pipeline.retry_limit ?? 3;
  const timeout = pipeline.timeout_ms ?? 5000;

  for (const subscriber of subscribers) {
    if (rateLimit) {
      const allowed = checkRateLimit(`subscriber:${subscriber.id}`, rateLimit.max, rateLimit.window_ms);
      if (!allowed) {
        console.log(`Rate limit hit for subscriber ${subscriber.id}, skipping event ${event.id}`);
        continue;
      }
    }

    let attempt = 1;
    let success = false;

    while (!success && attempt <= maxRetries)
      try {
        const { signature, ...payloadWithoutSignature } = event.payload;

        const headers: any = {
          "Content-Type": "application/json",
        };

        if (signature) {
          headers["X-Webhook-Signature"] = signature;
        }

        const res = await axios.post(subscriber.target_url, payloadWithoutSignature, {
          timeout,
          headers,
        });
        await createDelivery(event.id, subscriber.id, "success", res.status, JSON.stringify(res.data), attempt);
        success = true;
        console.log(`Delivered event ${event.id} to subscriber ${subscriber.id}`);
      } catch (err: any) {
        await createDelivery(event.id, subscriber.id, "failed", err.response?.status, err.message, attempt);
        attempt++;
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }

    if (!success) console.error(`Failed to deliver event ${event.id} to subscriber ${subscriber.id}`);
  }
}
