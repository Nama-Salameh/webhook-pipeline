import http from "http";
import { app } from "./app.js";
import { pool } from "./config/database.js";
import { env } from "./config/env.js";
import { startQueue } from "./queue/boss.js";
import { startWorker } from "./queue/worker.js";

const PORT = Number(env.PORT);

async function main() {
  await pool.query("SELECT 1");
  console.log("DB connected");

  await startQueue();
  startWorker();

  const server = http.createServer(app);

  server.listen({ port: PORT, host: "0.0.0.0" }, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
