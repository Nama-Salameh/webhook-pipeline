import { pool } from "../../config/database.js";

export const createDelivery = async (
  eventId: number,
  subscriberId: number,
  status: string,
  responseCode?: number,
  responseBody?: string,
  attempt = 1
) => {
  const result = await pool.query(
    `INSERT INTO deliveries
     (event_id, subscriber_id, status, response_code, response_body, attempt, last_attempt)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [eventId, subscriberId, status, responseCode, responseBody, attempt]
  );
  return result.rows[0];
};

export const getDeliveriesByEvent = async (eventId: number) => {
  const result = await pool.query(
    `SELECT * FROM deliveries WHERE event_id = $1 ORDER BY attempt ASC`,
    [eventId]
  );
  return result.rows;
};