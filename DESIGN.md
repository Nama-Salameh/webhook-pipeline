# Design Document — Webhook Processing Pipeline

## Overview

This service is a simplified event routing system — a webhook hits a pipeline, the payload is transformed by an action, and the result is forwarded to one or more subscriber URLs. The core design principle is reliability: ingestion is always fast, processing is always async, and every failure is recorded and retried.

---

## Architecture

```
Client
  │
  │  POST /webhooks/:pipelineId
  ▼
Express API
  │  1. Validate pipeline exists
  │  2. Save event to DB (status: queued)
  │  3. Enqueue job via pg-boss
  │  4. Return 200 immediately
  ▼
PostgreSQL
  │
  ▼
Background Worker (pg-boss)
  │  1. Fetch event from DB
  │  2. Load pipeline → resolve action
  │  3. Execute action on payload
  │  4. If skipped → log and stop
  │  5. Fetch subscribers for pipeline
  │  6. POST result to each subscriber URL
  │  7. Record delivery attempt (success or failed)
  │  8. Retry up to 3 times with exponential backoff
  ▼
Subscriber endpoints
```

The API and the worker are decoupled — the HTTP layer never waits for processing or delivery. This means a slow or unavailable subscriber has zero impact on webhook ingestion.

---

## Project Structure

```
src/
├── app.ts                  # Express app, middleware, route registration
├── server.ts               # Bootstrap: DB check, queue init, http.listen
├── config/
│   ├── database.ts         # pg connection pool
│   └── env.ts              # Typed environment variables
├── modules/
│   ├── pipeline/           # CRUD — controller, service, repository, routes, types
│   ├── webhook/            # Ingestion — saves event, enqueues job
│   ├── subscriber/         # Subscriber management per pipeline
│   └── delivery/           # Delivery history and manual retry
├── queue/
│   ├── boss.ts             # pg-boss instance, queue creation, error handling
│   └── worker.ts           # Job processor, action execution, delivery with retry
└── actions/
    ├── action.interface.ts  # execute(payload): Promise<any>
    ├── addTimeStamp.action.ts
    ├── transformKeys.action.ts
    └── filter.action.ts
```

Each module owns its own controller, service, repository, routes, and types. No module reaches into another module's repository — cross-module data access goes through the service layer.

---

## Database Schema

### `pipelines`
| Column      | Type      | Notes                         |
|-------------|-----------|-------------------------------|
| id          | SERIAL    | Primary key                   |
| name        | TEXT      | Pipeline name                 |
| action_type | TEXT      | Registered action identifier  |
| created_at  | TIMESTAMP |                               |

### `subscribers`
| Column      | Type      | Notes                  |
|-------------|-----------|------------------------|
| id          | SERIAL    | Primary key            |
| pipeline_id | INT       | FK → pipelines         |
| target_url  | TEXT      | Destination URL        |
| created_at  | TIMESTAMP |                        |

### `events`
| Column      | Type      | Notes                                 |
|-------------|-----------|---------------------------------------|
| id          | SERIAL    | Primary key                           |
| pipeline_id | INT       | FK → pipelines                        |
| payload     | JSONB     | Raw incoming webhook body             |
| status      | TEXT      | queued / processed / skipped / failed |
| result      | JSONB     | Output after action execution         |
| created_at  | TIMESTAMP |                                       |
| updated_at  | TIMESTAMP |                                       |

### `deliveries`
| Column        | Type      | Notes                           |
|---------------|-----------|---------------------------------|
| id            | SERIAL    | Primary key                     |
| event_id      | INT       | FK → events                     |
| subscriber_id | INT       | FK → subscribers                |
| status        | TEXT      | pending / success / failed      |
| response_code | INT       | HTTP status from subscriber     |
| response_body | TEXT      | Response body from subscriber   |
| attempt       | INT       | Attempt number (1–3)            |
| last_attempt  | TIMESTAMP |                                 |

---

## Technology Decisions

### Express over NestJS
Express is minimal and gives full control over structure. NestJS enforces its own conventions and adds significant boilerplate — the overhead isn't justified at this scale. The module structure here is explicit and intentional, not framework-imposed.

### PostgreSQL
Handles both relational data (pipelines, subscribers) and schema-less data (event payloads, delivery responses) via JSONB. No need for a separate document store. It's also the backing store for pg-boss, which keeps the infrastructure footprint small.

### pg-boss over Redis/BullMQ
pg-boss runs entirely on PostgreSQL — no additional broker needed. Jobs are durable (survive restarts), visible in the same DB as application data, and the queue semantics (retry, dead letter, concurrency) are sufficient for this use case. Adding Redis just to run a queue would be unnecessary complexity.

### axios for delivery
Built-in `timeout` support is the key reason. Without a timeout, a slow subscriber blocks the worker thread indefinitely. `fetch` in Node.js requires an `AbortController` and manual wiring to achieve the same — axios does it in one option.

### JSONB for payloads
Webhook payloads are schema-less by nature. JSONB stores them without requiring a fixed schema, supports GIN indexing for future querying, and allows the application to work with the data as a plain object without any deserialization step.

---

## Action Design

Actions implement a single interface: `execute(payload): Promise<any>`. They are stateless, have no dependencies, and are resolved by action type string at runtime. Adding a new action means creating one file and registering it in `index.ts` — nothing else changes.

### `addTimestamp`
Appends `processedAt` to the payload. Zero side effects, always succeeds. Useful for auditing and as a baseline example of the action contract.

### `transformKeys`
Renames payload fields using a `_keyMap` passed in the payload. Solves a real and common problem: systems that produce and consume webhooks often use different naming conventions. The caller controls the mapping per-request without any pipeline reconfiguration.

### `filter`
Skips delivery entirely if a field condition isn't met. This is the most practically useful action — most real pipelines should not forward every event. When skipped, no delivery is attempted and no error is thrown; the worker logs the reason and moves on.

---

## Retry Logic

Delivery is attempted up to 3 times per subscriber. On each failure, the worker waits `2000ms × attempt` before retrying (exponential backoff). Every attempt — success or failure — is written to the `deliveries` table with the HTTP status code and response body. This gives full observability into what happened without needing external logging infrastructure.

---

## Trade-offs and Limitations

- **Single action per pipeline** — supporting chained actions would require a `pipeline_steps` table and sequential execution. Kept simple intentionally.
- **Inline action config** — `_keyMap` and `_filter` live in the payload, which couples config to the event. A `config JSONB` column on `pipelines` would be cleaner for production.
- **No authentication** — all endpoints are open. API key middleware would be the first thing to add.
- **No webhook signature verification** — HMAC-SHA256 validation on incoming requests would prevent spoofed events.
- **No dead letter queue** — after 3 failed attempts the delivery is marked failed and stays in the DB. A DLQ with alerting would be the production approach.

---

## What I'd Do Differently in Production

- Store action config on the pipeline (`config JSONB`) rather than in the payload
- Add pipeline step chaining via a `pipeline_steps` table
- Validate incoming webhook signatures (HMAC-SHA256)
- Add API key authentication on management endpoints
- Move failed deliveries to a dead letter queue after max retries
- Add structured logging with pino and a `/metrics` endpoint for Prometheus
- Rate limit webhook ingestion per pipeline to prevent abuse
