import { pool } from "../../config/database.js";

export const createEvent = async (pipelineId: number, payload: any) => {
  const result = await pool.query(
    `INSERT INTO events (pipeline_id, payload) VALUES ($1,$2) RETURNING *`,
    [pipelineId, payload]
  );
  return result.rows[0];
};

export const getEventById = async (id: number) => {
  const result = await pool.query(`SELECT * FROM events WHERE id=$1`, [id]);
  return result.rows[0];
};

export const getDeliveriesByEventId = async (eventId: number) => {
  const result = await pool.query(
    `SELECT * FROM deliveries WHERE event_id=$1 ORDER BY attempt ASC`,
    [eventId]
  );
  return result.rows;
};