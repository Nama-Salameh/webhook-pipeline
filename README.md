# Webhook Processing Pipeline

![CI](https://github.com/Nama-Salameh/webhook-pipeline/actions/workflows/ci.yml/badge.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![Node](https://img.shields.io/badge/node-22-green?logo=node.js)
![TypeScript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue?logo=postgresql)
![pino](https://img.shields.io/badge/logger-pino-green)
![pg--boss](https://img.shields.io/badge/queue-pg--boss-blue)

A service that receives webhooks, processes them through a job queue, and delivers results to registered subscriber URLs — a simplified Zapier-style pipeline engine.

**Live API:** `https://webhook-api-244400976460.europe-west1.run.app`
**Live Dashboard:** `https://webhook-dashboard-244400976460.europe-west1.run.app`

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
- Pino (structured logging)
- React + Vite + Tailwind (dashboard)
- Docker + Docker Compose
- GitHub Actions CI/CD

---

## Getting Started

### Prerequisites

- Docker Desktop, or Docker Engine on Linux/WSL (e.g. Ubuntu with `sudo apt install docker.io docker-compose-plugin`)

### Run with Docker

```bash
git clone https://github.com/Nama-Salameh/webhook-pipeline.git
cd webhook-pipeline

docker compose up --build
```

Server runs on `http://localhost:3000`. Migrations run automatically on startup.

Dashboard runs separately — see [dashboard/README.md](./dashboard/README.md).

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

| Variable         | Description                                    | Default (docker-compose)                              |
|------------------|------------------------------------------------|-------------------------------------------------------|
| `PORT`           | Server port                                    | `3000`                                                |
| `DATABASE_URL`   | PostgreSQL connection URL                      | `postgres://postgres:postgres@postgres:5432/webhook`  |
| `RUN_MIGRATIONS` | Run migrations on startup                      | `true`                                                |
| `API_KEY`        | API key for auth — if unset, auth is disabled  | `webhook-secret-123`                                  |
| `WEBHOOK_SECRET` | HMAC secret used by the `addSignature` action to sign outgoing webhook deliveries | `webhook-hmac-secret` |
| `LOG_LEVEL`      | Pino log level                                 | `info`                                                |

---

## Authentication

All endpoints except `POST /webhooks/:pipelineId` and `GET /health` require an `x-api-key` header.

```
x-api-key: webhook-secret-123
```

If `API_KEY` is not set in the environment, authentication is skipped entirely.

The webhook ingestion endpoint is intentionally public. Webhooks are sent by external systems (GitHub, Stripe, your own services) that authenticate via their own mechanism — requiring an API key would mean every external sender needs to know your internal key, which breaks the standard webhook model. Security on inbound webhooks is handled separately via signature verification (see Trade-offs).

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

Returns the event, its computed status (`pending` / `success` / `failed` / `partial`), and the full delivery history. Status is based on each subscriber's last delivery attempt — `partial` means some subscribers succeeded and some failed.

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

- `total_events` — webhooks received and picked up by the worker
- `success_deliveries` — individual delivery attempts that got a 2xx response
- `failed_deliveries` — individual delivery attempts that failed
- `retries` — number of retry attempts made after an initial failure (not counting the first attempt)
- `avg_response_time_ms` — average time to get a response from a subscriber URL

Note: `success_deliveries + failed_deliveries` will be higher than `total_events` because each event is delivered to every subscriber, and each failed attempt is counted separately.

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

## Testing with Thunder Client

Thunder Client is a VS Code extension for making HTTP requests (similar to Postman). Install it from the VS Code extensions panel, then use the examples below.

Set this header on all requests except `POST /webhooks/:pipelineId`:
```
x-api-key: webhook-secret-123
```

### 1. Create a pipeline

**POST** `http://localhost:3000/pipelines`

Headers:
```
Content-Type: application/json
x-api-key: webhook-secret-123
```

Body (pick one action type):

```json
{ "name": "Timestamp Pipeline", "action_type": "addTimestamp" }
```
```json
{ "name": "Key Transform Pipeline", "action_type": "transformKeys" }
```
```json
{ "name": "Filter Pipeline", "action_type": "filter" }
```
```json
{
  "name": "Mask Pipeline",
  "action_type": "maskSensitive",
  "action_options": { "fields": ["password", "token"], "mask": "XXXX" }
}
```
```json
{
  "name": "Signature Pipeline",
  "action_type": "addSignature",
  "action_options": { "secret": "my-secret" }
}
```

### 2. List pipelines

**GET** `http://localhost:3000/pipelines`

Headers:
```
x-api-key: webhook-secret-123
```

### 3. Update a pipeline

**PUT** `http://localhost:3000/pipelines/1`

Headers:
```
Content-Type: application/json
x-api-key: webhook-secret-123
```
Body (all fields optional):
```json
{
  "name": "Renamed Pipeline",
  "action_options": { "fields": ["email"], "mask": "***" }
}
```

### 4. Add a subscriber

**POST** `http://localhost:3000/pipelines/1/subscribers`

Headers:
```
Content-Type: application/json
x-api-key: webhook-secret-123
```
Body:
```json
{ "target_url": "https://webhook.site/your-unique-id" }
```

Get a free test URL at [webhook.site](https://webhook.site) — no signup needed.

### 5. Send a webhook (no auth header needed)

**POST** `http://localhost:3000/webhooks/1`

Header: `Content-Type: application/json` only.

Body examples per action type:

```json
// addTimestamp — processedAt is appended
{ "orderId": 123, "amount": 50 }

// transformKeys — _keyMap renames fields, is stripped from output
{ "orderId": 123, "_keyMap": { "orderId": "order_id" } }

// filter — delivery skipped if field doesn't match value
{ "status": "paid", "_filter": { "field": "status", "value": "paid" } }

// maskSensitive — sensitive fields replaced with *** (or custom mask)
{ "username": "john", "password": "secret123", "token": "abc" }

// addSignature — X-Webhook-Signature header added to outgoing delivery
{ "orderId": 123, "amount": 50 }
```

### 6. Check event status

**GET** `http://localhost:3000/events/1/status`

### 7. Check deliveries

**GET** `http://localhost:3000/deliveries/pipeline/1`

### 8. Retry a failed delivery

**POST** `http://localhost:3000/deliveries/1/retry`

### 9. Toggle a pipeline

**PATCH** `http://localhost:3000/pipelines/1/toggle`

### 10. Delete a pipeline

**DELETE** `http://localhost:3000/pipelines/1`

Returns `204 No Content`.

### 11. Check metrics

**GET** `http://localhost:3000/metrics`

**GET** `http://localhost:3000/pipelines/1/metrics`

---

## curl Examples

```bash
# 1. Create a pipeline (pick one action type)
curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Timestamp Pipeline", "action_type": "addTimestamp"}'

curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Key Transform Pipeline", "action_type": "transformKeys"}'

curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Filter Pipeline", "action_type": "filter"}'

curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Mask Pipeline", "action_type": "maskSensitive", "action_options": {"fields": ["password", "token"], "mask": "XXXX"}}'

curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Signature Pipeline", "action_type": "addSignature", "action_options": {"secret": "my-secret"}}'

# 2. List pipelines
curl http://localhost:3000/pipelines \
  -H "x-api-key: webhook-secret-123"

# 3. Update a pipeline (all fields optional)
curl -X PUT http://localhost:3000/pipelines/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"name": "Renamed Pipeline", "action_options": {"fields": ["email"], "mask": "***"}}'

# 4. Add a subscriber
curl -X POST http://localhost:3000/pipelines/1/subscribers \
  -H "Content-Type: application/json" \
  -H "x-api-key: webhook-secret-123" \
  -d '{"target_url": "https://webhook.site/your-unique-id"}'

# 5. Send a webhook (no auth needed — body depends on action type)
# addTimestamp
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"orderId": 123, "amount": 50}'

# transformKeys
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"orderId": 123, "_keyMap": {"orderId": "order_id"}}'

# filter
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "paid", "_filter": {"field": "status", "value": "paid"}}'

# maskSensitive
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "secret123", "token": "abc"}'

# addSignature
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"orderId": 123, "amount": 50}'

# 6. Check event status
curl http://localhost:3000/events/1/status \
  -H "x-api-key: webhook-secret-123"

# 7. Check deliveries
curl http://localhost:3000/deliveries/pipeline/1 \
  -H "x-api-key: webhook-secret-123"

# 8. Retry a failed delivery
curl -X POST http://localhost:3000/deliveries/1/retry \
  -H "x-api-key: webhook-secret-123"

# 9. Toggle a pipeline
curl -X PATCH http://localhost:3000/pipelines/1/toggle \
  -H "x-api-key: webhook-secret-123"

# 10. Delete a pipeline
curl -X DELETE http://localhost:3000/pipelines/1 \
  -H "x-api-key: webhook-secret-123"

# 11. Check metrics
curl http://localhost:3000/metrics \
  -H "x-api-key: webhook-secret-123"

curl http://localhost:3000/pipelines/1/metrics \
  -H "x-api-key: webhook-secret-123"
```

---

## CI/CD

GitHub Actions runs on every push — type checks and builds the project against Node 22 with a live PostgreSQL service container.

---

## Architecture & Design Decisions

See [DESIGN.md](./DESIGN.md).
