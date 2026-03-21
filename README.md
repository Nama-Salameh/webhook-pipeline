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
6. Failed deliveries are retried up to 3 times with exponential backoff

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

| Variable          | Description               | Default                                               |
|-------------------|---------------------------|-------------------------------------------------------|
| `PORT`            | Server port               | `3000`                                                |
| `DATABASE_URL`    | PostgreSQL connection URL | `postgres://postgres:postgres@localhost:5432/webhook` |
| `RUN_MIGRATIONS`  | Run migrations on startup | `true`                                                |

---

## API Reference

### Health

```
GET /health
→ { "status": "ok" }
```

### Pipelines

| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| POST   | `/pipelines`     | Create a pipeline  |
| GET    | `/pipelines`     | List all pipelines |
| DELETE | `/pipelines/:id` | Delete a pipeline  |

```json
POST /pipelines
{
  "name": "My Pipeline",
  "action_type": "addTimestamp"
}
```

Action types: `addTimestamp`, `transformKeys`, `filter`

### Webhooks

```
POST /webhooks/:pipelineId
→ { "received": true, "eventId": 1 }
```

Ingests a webhook and queues it for background processing. Returns immediately.

```json
// addTimestamp — appends processedAt to the payload
{ "name": "test", "value": 123 }

// transformKeys — renames fields using _keyMap
{
  "orderId": 1234,
  "customer": "test",
  "_keyMap": { "orderId": "order_id" }
}

// filter — skips delivery if condition not met
{
  "status": "paid",
  "amount": 99,
  "_filter": { "field": "status", "value": "paid" }
}
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

### Deliveries

| Method | Endpoint                           | Description                    |
|--------|------------------------------------|--------------------------------|
| GET    | `/deliveries/pipeline/:pipelineId` | List deliveries for a pipeline |
| POST   | `/deliveries/:id/retry`            | Retry a failed delivery        |

---

## End-to-End Example

**Get a free test URL:**
1. Go to [webhook.site](https://webhook.site)
2. A unique URL appears automatically — e.g. `https://webhook.site/a1b2c3d4-5678-...`
3. Copy it and use it as `target_url` — no signup needed

```bash
# 1. Create a pipeline
curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -d '{"name": "Order Pipeline", "action_type": "addTimestamp"}'

# 2. Add a subscriber (paste your webhook.site URL)
curl -X POST http://localhost:3000/pipelines/1/subscribers \
  -H "Content-Type: application/json" \
  -d '{"target_url": "https://webhook.site/your-unique-id"}'

# 3. Send a webhook
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "value": 123}'

# 4. Check event status (use eventId from step 3)
curl http://localhost:3000/events/1/status

# 5. Check full delivery history
curl http://localhost:3000/deliveries/pipeline/1
```

The webhook.site dashboard shows the received payload with `processedAt` added by the action.

---

## CI/CD

GitHub Actions runs on every push — type checks and builds the project against Node 22 with a live PostgreSQL service container.

---

## Architecture & Design Decisions

For schema design, technology choices, action design, retry logic rationale, and trade-offs see [DESIGN.md](./DESIGN.md).
