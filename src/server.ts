import { app } from "./app.js";
import { pool } from "./config/database.js";
import { startQueue } from "./queue/boss.js";
import { startWorker } from "./queue/worker.js";

const PORT = 3000;

pool.query("SELECT 1").then(() => console.log("DB connected")).catch(console.error);

await startQueue();
startWorker();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});