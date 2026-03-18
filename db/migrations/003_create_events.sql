CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  pipeline_id INT REFERENCES pipelines(id),
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);