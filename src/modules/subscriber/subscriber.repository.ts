import { pool } from "../../config/database.js";
import { CreateSubscriberDTO, Subscriber } from "./subscriber.types.js";

export const createSubscriber = async (
  pipelineId: number,
  dto: CreateSubscriberDTO
): Promise<Subscriber> => {
  const result = await pool.query(
    `
      INSERT INTO subscribers (pipeline_id, target_url)
      VALUES ($1, $2)
      RETURNING *
    `,
    [pipelineId, dto.target_url]
  );

  return result.rows[0];
};

export const getSubscribersByPipeline = async (
  pipelineId: number
): Promise<Subscriber[]> => {
  const result = await pool.query(
    `SELECT * FROM subscribers WHERE pipeline_id=$1 ORDER BY id DESC`,
    [pipelineId]
  );
  return result.rows;
};

export const deleteSubscriber = async (id: number) => {
  await pool.query(`DELETE FROM subscribers WHERE id=$1`, [id]);
};