# Webhook Processing Pipeline

A service that receives webhooks, processes them through a job queue, and delivers results to registered subscriber URLs.

---

## Tech Stack

- TypeScript + Express
- PostgreSQL + pg-boss
- Docker + Docker Compose
- GitHub Actions

---

## Getting Started

### Prerequisites

- Docker Desktop (or Docker Engine on Linux/WSL)
- Node.js 20+

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Nama-Salameh/webhook-pipeline.git
cd webhook-pipeline

# 2. Copy env file
cp .env.example .env

# 3. Start the database
docker compose up -d

# 4. Run migrations
npm run migrate

# 5. Install dependencies and start the server
npm install
npm run dev
```

Server runs on `http://localhost:3000`.

> On Windows, run inside WSL for best compatibility.

---

## Environment Variables

| Variable       | Description               | Default                                               |
|----------------|---------------------------|-------------------------------------------------------|
| `PORT`         | Server port               | `3000`                                                |
| `DATABASE_URL` | PostgreSQL connection URL | `postgres://postgres:postgres@localhost:5432/webhook` |

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
  "actionType": "transformKeys"
}
```

Action types: `addTimestamp`, `transformKeys`, `filter`

### Webhooks

```
POST /webhooks/:pipelineId
```

Ingests an event and queues it for background processing.

```json
// transformKeys — renames fields using _keyMap
{
  "orderId": 1234,
  "customer": "Namaa",
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

| Method | Endpoint                                  | Description           |
|--------|-------------------------------------------|-----------------------|
| POST   | `/pipelines/:pipelineId/subscribers`      | Add a subscriber      |
| GET    | `/pipelines/:pipelineId/subscribers`      | List subscribers      |
| DELETE | `/pipelines/:pipelineId/subscribers/:id`  | Remove a subscriber   |

```json
POST /pipelines/1/subscribers
{
  "targetUrl": "https://your-endpoint.com/hook"
}
```

### Deliveries

| Method | Endpoint                           | Description                    |
|--------|------------------------------------|--------------------------------|
| GET    | `/deliveries/pipeline/:pipelineId` | List deliveries for a pipeline |
| POST   | `/deliveries/:id/retry`            | Retry a failed delivery        |

---

## End-to-End Example

```bash
# 1. Create a pipeline
curl -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -d '{"name": "Order Pipeline", "actionType": "filter"}'

# 2. Add a subscriber
curl -X POST http://localhost:3000/pipelines/1/subscribers \
  -H "Content-Type: application/json" \
  -d '{"targetUrl": "https://your-endpoint.com/hook"}'

# 3. Send a webhook
curl -X POST http://localhost:3000/webhooks/1 \
  -H "Content-Type: application/json" \
  -d '{"orderId": 99, "status": "paid", "_filter": {"field": "status", "value": "paid"}}'

# 4. Check delivery history
curl http://localhost:3000/deliveries/pipeline/1
```

---

## CI/CD

GitHub Actions runs on every push — installs dependencies, type checks, and runs tests.

---

## Design

For architecture decisions, schema design, and trade-offs see [DESIGN.md](./DESIGN.md).
