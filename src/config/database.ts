import pkg from "pg";
const { Pool } = pkg;
import { env } from "./env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});