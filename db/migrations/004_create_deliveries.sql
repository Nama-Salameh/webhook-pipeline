CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  subscriber_id INT REFERENCES subscribers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',       -- pending | success | failed
  response_code INT,
  response_body TEXT,
  attempt INT DEFAULT 1,
  last_attempt TIMESTAMP DEFAULT NOW()
);