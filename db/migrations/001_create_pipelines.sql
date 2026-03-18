CREATE TABLE pipelines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);