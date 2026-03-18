import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
});

export const startQueue = async () => {
  await boss.start();
  console.log("PgBoss queue started");
};