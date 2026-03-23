import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
});

export const startQueue = async () => {
  await boss.start();
  logger.info("PgBoss queue started");

  await boss.createQueue("process_event");
  logger.info("Queue 'process_event' created");

  boss.on("error", (err) => logger.error({ err }, "PgBoss error"));
};
