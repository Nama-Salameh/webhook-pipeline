# Webhook Processing Pipeline

![CI](https://github.com/Nama-Salameh/webhook-pipeline/actions/workflows/ci.yml/badge.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-22-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue?logo=postgresql)

A service that receives webhooks, processes them through a job queue, and delivers results to registered subscriber URLs — a simplified Zapier-style pipeline engine.

---

## How It Works

```
Incoming webhook → queued as a job → worker processes it → delivers to subscribers
```

1. A webhook hits `POST /webhooks/:pipelineId`
2. The payload is saved to the DB and queued via pg-boss — the HTTP response returns immediately
3. The background worker picks up the job, runs the pipeline's action on the payload
4. The result is POSTed to every subscriber URL registered on that pipeline
5. Each delivery is recorded with status, response code, and attempt number
6. Failed deliveries are retried up to `retry_limit` times (default 3) with exponential backoff

---

## Tech Stack

- TypeScript + Express
- PostgreSQL + pg-boss (job queue)
- Docker + Docker Compose
- GitHub Actions CI/CD

---

## Getting Started

### Prerequisites

- Docker Desktop (or Docker Engine on Linux/WSL)

### Run with Docker

```bash
git clone https://github.com/Nama-Salameh/webhook-pipeline.git
cd webhook-pipeline

docker compose up --build
```

Server runs on `http://localhost:3000`. Migrations run automatically on startup.

### Local Development (without Docker)

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run migrate
npm run dev
```

---

## Environment Variables

| Variable         | Description                          | Default                                               |
|------------------|--------------------------------------|-------------------------------------------------------|
| `PORT`           | Server port                          | `3000`                                                |
| `DATABASE_URL`   | PostgreSQL connection URL            | `postgres://postgres:postgres@localhost:5432/webhook` |
| `RUN_MIGRATIONS` | Run migrations on startup            | `true`                                                |
| `API_KEY`        | API key for auth (optional)          | unset (auth disabled if not set)                      |
| `WEBHOOK_SECRET` | HMAC secret for `addSignature` action | `default-secret`                                     |

---

## Authentication

All endpoints except `POST /webhooks/:pipelineId` and `GET /health` require an `x-api-key` header.

```bash
x-api-key: webhook-secret-123
```

If `API_KEY` is not set in the environment, authentication is skipped entirely. The webhook ingestion endpoint is intentionally public — it must be reachable without credentials.

Unauthorized requests return:
```json
{ "error": "Unauthorized" }
```

---

## Error Responses

All errors follow a consistent format:

```json
{ "error": "message describing what went wrong" }
```

| Status | Meaning                              |
|--------|--------------------------------------|
| 400    | Validation error (bad input)         |
| 401    | Unauthorized (missing/invalid key)   |
| 404    | Resource not found                   |
| 500    | Unexpected server error              |

---

## API Reference

### Health

```
GET /health
→ { "status": "ok" }
```

### Pipelines

| Method | Endpoint                 | Description               |
|--------|--------------------------|---------------------------|
| POST   | `/pipelines`             | Create a pipeline         |
| GET    | `/pipelines`             | List all pipelines        |
| PUT    | `/pipelines/:id`         | Update a pipeline         |
| PATCH  | `/pipelines/:id/toggle`  | Enable/disable a pipeline |
| GET    | `/pipelines/:id/metrics` | Per-pipeline metrics      |
| DELETE | `/pipelines/:id`         | Delete a pipeline         |

```json
POST /pipelines
{
  "name": "My Pipeline",
  "action_type": "addTimestamp"
}
```

Action types: `addTimestamp`, `transformKeys`, `filter`, `maskSensitive`, `addSignature`

An invalid `action_type` returns a `400` error immediately.

Pipeline options via `action_options`:

```json
// maskSensitive — custom fields and mask string
{
  "name": "Mask Pipeline",
  "action_type": "maskSensitive",
  "action_options": { "fields": ["password", "token"], "mask": "XXXX" }
}

// addSignature — custom HMAC secret
{
  "name": "Signature Pipeline",
  "action_type": "addSignature",
  "action_options": { "secret": "my-secret" }
}

// rate limiting per subscriber (works with any action type)
{
  "name": "Rate Limited Pipeline",
  "action_type": "addTimestamp",
  "action_options": { "rate_limit": { "max": 5, "window_ms": 10000 } }
}
```

Pipeline-level delivery config (optional):

| Field         | Description                          | Default |
|---------------|--------------------------------------|---------|
| `retry_limit` | Max delivery attempts per subscriber | `3`     |
| `timeout_ms`  | HTTP timeout per delivery attempt    | `5000`  |

### Webhooks

```
POST /webhooks/:pipelineId
→ { "received": true, "eventId": 1 }
```

Ingests a webhook and queues it for background processing. Returns immediately. No auth required.

If the pipeline does not exist or is disabled, returns an error immediately.

```json
// addTimestamp — appends processedAt
{ "name": "test", "value": 123 }
// → { "name": "test", "value": 123, "processedAt": "2026-..." }

// transformKeys — renames fields using _keyMap (stripped from output)
{ "orderId": 1234, "_keyMap": { "orderId": "order_id" } }
// → { "order_id": 1234 }

// filter — skips delivery if field doesn't match
{ "status": "draft", "_filter": { "field": "status", "value": "paid" } }
// → skipped (no delivery recorded)

// maskSensitive — replaces sensitive fields with ***
// default fields: password, token, secret, email, phone, ssn
{ "username": "test", "password": "secret123" }
// → { "username": "test", "password": "***" }

// addSignature — HMAC-SHA256 signature sent as X-Webhook-Signature header
{ "orderId": 1234, "amount": 99 }
// → body: { "orderId": 1234, "amount": 99, "timestamp": "2026-..." }
// → header: X-Webhook-Signature: <hmac-sha256>
```

### Subscribers

| Method | Endpoint                                 | Description         |
|--------|------------------------------------------|---------------------|
| POST   | `/pipelines/:pipelineId/subscribers`     | Add a subscriber    |
| GET    | `/pipelines/:pipelineId/subscribers`     | List subscribers    |
| DELETE | `/pipelines/:pipelineId/subscribers/:id` | Remove a subscriber |

```json
POST /pipelines/1/subscribers
{
  "target_url": "https://webhook.site/your-unique-id"
}
```

### Events

```
GET /events/:id/status
→ { event, status, attempts, deliveries }
```

Returns the event, its computed status (`pending` / `success` / `failed`), and the full delivery history.

### Metrics

System-wide (in-memory, resets on restart):
```
GET /metrics
→ {
    "total_events": 42,
    "success_deliveries": 38,
    "failed_deliveries": 4,
    "retries": 3,
    "avg_response_time_ms": 142
  }
```

Per-pipeline (live from DB, persists across restarts):
```
GET /pipelines/:id/metrics
→ {
    "pipeline_id": 1,
    "total_events": "12",
    "success": "10",
    "failed": "2",
    "avg_response_time_ms": "118"
  }
```

### Deliveries

| Method | Endpoint                           | Description                    |
|--------|------------------------------------|--------------------------------|
| GET    | `/deliveries/pipeline/:pipelineId` | List deliveries for a pipeline |
| POST   | `/deliveries/:id/retry`            | Retry a failed delivery        |

---

## End-to-End Example

**Get a free test URL:**
1. Go to [webhook.site](https://webhook.site)
2. Copy the unique URL — e.g. `https://webhook.site/a1b2c3d4-...`
3. Use it as `target_url` — no signup needed

```bash
# 1. Create a pipeline
curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Order Pipeline", "action_type": "addTimestamp"}'

# 2. Add a subscriber
curl -X POST http://localhost:3000/pipelines/1/subscribers \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"target_url": "https://webhook.site/your-unique-id"}'

# 3. Send a webhook (no auth needed)
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}'

# 4. Check event status
curl http://localhost:3000/events/1/status \
  -H "x-api-key: webhook-secret-123"

# 5. Check delivery history
curl http://localhost:3000/deliveries/pipeline/1 \
  -H "x-api-key: webhook-secret-123"

# 6. Check system metrics
curl http://localhost:3000/metrics \
  -H "x-api-key: webhook-secret-123"

# 7. Check pipeline metrics
curl http://localhost:3000/pipelines/1/metrics \
  -H "x-api-key: webhook-secret-123"
```

---

## CI/CD

GitHub Actions runs on every push — type checks and builds the project against Node 22 with a live PostgreSQL service container.

---

## Architecture & Design Decisions

See [DESIGN.md](./DESIGN.md).
