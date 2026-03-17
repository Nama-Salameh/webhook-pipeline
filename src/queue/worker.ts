import { boss } from "./boss.js";

export const startWorker = () => {
  boss.work("process_event", async (job: any) => {
    console.log("Processing job:", job.data);
  });
};