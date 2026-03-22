CREATE TABLE pipelines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_options JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  retry_limit INT DEFAULT 3,
  timeout_ms INT DEFAULT 5000,
  created_at TIMESTAMP DEFAULT NOW()
);