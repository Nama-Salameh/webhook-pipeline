import { pool } from "../../config/database.js";
import { CreatePipelineDTO } from "./pipeline.types.js";
import { ValidationError } from "../../middleware/error.js";

export const createPipeline = async (data: CreatePipelineDTO) => {
  const result = await pool.query(
    `INSERT INTO pipelines (name, action_type, action_options)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.action_type, JSON.stringify(data.action_options ?? {})]
  );
  return result.rows[0];
};

export const getPipelines = async () => {
  const result = await pool.query(`SELECT * FROM pipelines ORDER BY id DESC`);
  return result.rows;
};

export const getPipelineById = async (id: number) => {
  const result = await pool.query(`SELECT * FROM pipelines WHERE id = $1`, [id]);
  return result.rows[0];
};

export const deletePipeline = async (id: number) => {
  await pool.query(`DELETE FROM pipelines WHERE id = $1`, [id]);
};

export const updatePipeline = async (id: number, data: Partial<CreatePipelineDTO>) => {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name)           { fields.push(`name = $${fields.length + 1}`);           values.push(data.name); }
  if (data.action_type)    { fields.push(`action_type = $${fields.length + 1}`);    values.push(data.action_type); }
  if (data.action_options) { fields.push(`action_options = $${fields.length + 1}`); values.push(JSON.stringify(data.action_options)); }

  if (fields.length === 0) throw new ValidationError("No fields to update");

  values.push(id);
  const result = await pool.query(
    `UPDATE pipelines SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return result.rows[0];
};

export const togglePipeline = async (id: number, enabled: boolean) => {
  const result = await pool.query(
    `UPDATE pipelines SET enabled = $1 WHERE id = $2 RETURNING *`,
    [enabled, id]
  );
  return result.rows[0];
};

export const getPipelineMetrics = async (pipelineId: number) => {
  const result = await pool.query(
    `SELECT
      COUNT(DISTINCT e.id) as total_events,
      COUNT(*) FILTER (WHERE d.status = 'success') as success,
      COUNT(*) FILTER (WHERE d.status = 'failed') as failed,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (d.last_attempt - e.created_at)) * 1000)), 0) as avg_response_time_ms
     FROM events e
     LEFT JOIN deliveries d ON d.event_id = e.id
     WHERE e.pipeline_id = $1`,
    [pipelineId]
  );
  return { pipeline_id: pipelineId, ...result.rows[0] };
};
