import http from "http";
import { app } from "./app.js";
import { pool } from "./config/database.js";
import { env } from "./config/env.js";
import { startQueue } from "./queue/boss.js";
import { startWorker } from "./queue/worker.js";
import { logger } from "./lib/logger.js";

const PORT = Number(env.PORT);

async function main() {
  await pool.query("SELECT 1");
  logger.info("DB connected");

  await startQueue();
  startWorker();

  const server = http.createServer(app);

  server.listen({ port: PORT, host: "0.0.0.0" }, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    logger.error({ err }, "Server error");
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
