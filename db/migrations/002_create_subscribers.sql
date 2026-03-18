CREATE TABLE subscribers (
  id SERIAL PRIMARY KEY,
  pipeline_id INT REFERENCES pipelines(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);