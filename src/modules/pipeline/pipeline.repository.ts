import { pool } from "../../config/database.js";
import { CreatePipelineDTO } from "./pipeline.types.js";

export const createPipeline = async (data: CreatePipelineDTO) => {
  const result = await pool.query(
    `
      INSERT INTO pipelines (name, action_type)
      VALUES ($1, $2)
      RETURNING *
    `,
    [data.name, data.action_type]
  );

  return result.rows[0];
};

export const getPipelines = async () => {
  const result = await pool.query(
    `SELECT * FROM pipelines ORDER BY id DESC`
  );

  return result.rows;
};

export const getPipelineById = async (id: number) => {
  const result = await pool.query(
    `SELECT * FROM pipelines WHERE id = $1`,
    [id]
  );

  return result.rows[0];
};

export const deletePipeline = async (id: number) => {
  await pool.query(`DELETE FROM pipelines WHERE id = $1`, [id]);
};