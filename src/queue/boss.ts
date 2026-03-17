import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: "public",
});

export const startQueue = async () => {
  await boss.start();
  console.log("PgBoss queue started");

  await boss.createQueue("process_event");
  console.log("Queue 'process_event' created");
};