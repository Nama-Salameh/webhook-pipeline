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
├── metrics/
│   └── metrics.ts          # In-memory metrics store (read by worker, exposed via API)
├── modules/
│   ├── pipeline/           # CRUD, toggle, per-pipeline metrics
│   ├── webhook/            # Ingestion + event status endpoint
│   ├── subscriber/         # Subscriber management per pipeline
│   ├── delivery/           # Delivery history and manual retry
│   └── metrics/            # GET /metrics controller and routes
├── queue/
│   ├── boss.ts             # pg-boss instance, queue creation, error handling
│   └── worker.ts           # Job processor, action execution, delivery with retry
├── actions/
│   ├── action.interface.ts
│   ├── addTimeStamp.action.ts
│   ├── transformKeys.action.ts
│   ├── filter.action.ts
│   ├── maskSensitive.action.ts
│   └── addSignature.action.ts
└── utils/
    └── rateLimiter.ts      # In-memory token bucket rate limiter
```

Each module owns its own controller, service, repository, routes, and types. No module reaches into another module's repository — cross-module data access goes through the service layer.

---

## Database Schema

### `pipelines`
| Column         | Type      | Notes                                      |
|----------------|-----------|--------------------------------------------|
| id             | SERIAL    | Primary key                                |
| name           | TEXT      | Pipeline name                              |
| action_type    | TEXT      | Registered action identifier               |
| action_options | JSONB     | Action config (fields, secret, rate_limit) |
| enabled        | BOOLEAN   | Whether pipeline accepts events            |
| retry_limit    | INT       | Max delivery attempts (default 3)          |
| timeout_ms     | INT       | HTTP timeout per attempt (default 5000ms)  |
| created_at     | TIMESTAMP |                                            |

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

### Docker setup
Multi-stage Dockerfile — the builder stage compiles TypeScript, the final stage copies only compiled output and production dependencies, keeping the image lean. A `docker-entrypoint.sh` runs migrations before starting the server, so `docker compose up --build` is the only command needed to get a fully working environment from scratch.

The compose file has two services: `postgres` (with a healthcheck) and `api` which waits for postgres to be healthy before starting.

### Worker in the same process as the API
The background worker runs inside the same Node.js process as the Express server — not in a separate container. For this scale, the overhead of a second container (separate image, separate deploy, inter-service networking) isn't justified. pg-boss handles concurrency and job locking at the DB level, so running the worker in-process is safe. Splitting it out would be the right call if the worker became CPU-bound or needed independent scaling.

### webhook.site over local subscriber for testing
When the API runs inside Docker, `localhost` inside the container refers to the container itself — not the host machine. A local test subscriber on port 4000 is unreachable unless you resolve the host gateway IP, which varies by machine and Docker network configuration.

[webhook.site](https://webhook.site) solves this cleanly — it's a public URL that the container can reach without any networking workarounds. It also provides a visual inspector in the browser, making it easier to verify the exact payload shape delivered by the worker.

| | Local subscriber | webhook.site |
|---|---|---|
| Docker networking | ❌ Requires host gateway IP | ✅ No issues |
| Setup | Extra terminal needed | ✅ Browser only |
| Debugging | Hard | ✅ Visual inspector |
| Scope | Local only | ✅ Public internet |

---

## Action Design

Actions implement a single interface: `execute(payload): Promise<any>`. They are stateless, have no dependencies, and are resolved by action type string at runtime. Adding a new action means creating one file and registering it in `index.ts` — nothing else changes.

### `addTimestamp`
Appends `processedAt` (ISO timestamp) to the payload. Zero side effects, always succeeds. Useful for auditing when the event was processed.

### `transformKeys`
Renames payload fields using a `_keyMap` passed in the payload. The `_keyMap` key itself is stripped from the output. Solves a common real-world problem: systems that produce and consume webhooks often use different naming conventions. The caller controls the mapping per-request without any pipeline reconfiguration.

### `filter`
Checks a single field condition (`_filter.field === _filter.value`). If the condition isn't met, returns `{ skipped: true }` — the worker logs the reason and stops, no delivery is attempted. The `_filter` key is stripped from the forwarded payload when the condition passes.

### `maskSensitive`
Replaces known sensitive fields with `***` before delivery. Default masked fields: `password`, `token`, `secret`, `email`, `phone`, `ssn` (case-insensitive match). Prevents credentials from being forwarded to subscriber URLs in plaintext. Customizable via `action_options.fields` and `action_options.mask`.

### `addSignature`
Appends a `timestamp` (ISO) and a `signature` field — an HMAC-SHA256 hash of the payload including the timestamp — before delivery. The signature is then stripped from the payload body and sent as an `X-Webhook-Signature` header instead, which is the standard pattern used by Stripe and GitHub. Subscribers verify the header to confirm authenticity. Secret is set via `action_options.secret` or falls back to the `WEBHOOK_SECRET` env var.

---

## Retry Logic

Delivery is attempted up to `retry_limit` times per subscriber (default 3) with exponential backoff (`2000ms × attempt`). Both `retry_limit` and `timeout_ms` are configurable per pipeline at creation time. Every attempt — success or failure — is written to the `deliveries` table with the HTTP status code and response body.

**Why retry?** Subscriber endpoints can fail transiently — a deploy, a timeout, a momentary overload. Without retries, a single blip causes permanent data loss. Retrying gives the subscriber a chance to recover.

**Why exponential backoff?** Retrying immediately after a failure often hits the same problem again. Spacing retries with increasing delays gives the failing service time to recover, and avoids hammering an already-struggling endpoint — which would make the situation worse. This is the same pattern used by every major message queue and HTTP client library.

---

## Rate Limiting

Per-subscriber rate limiting is configurable via `action_options.rate_limit` (`max` requests per `window_ms`). Implemented as an in-memory token bucket — no Redis needed. If a subscriber exceeds the limit within the window, the delivery is skipped and logged.

This prevents a single slow or misbehaving subscriber from being hammered during high-volume event bursts.

---

## Metrics

Two levels of metrics are exposed:

**System-wide** (`GET /metrics`) — in-memory counters tracked by the worker process:
- `total_events` — events picked up by the worker
- `success_deliveries` — successful HTTP deliveries
- `failed_deliveries` — failed delivery attempts
- `retries` — retry attempts made
- `avg_response_time_ms` — average delivery response time across all pipelines

Resets on server restart. For production these would be persisted to a time-series store (Prometheus + Grafana).

**Per-pipeline** (`GET /pipelines/:id/metrics`) — aggregated live from the DB:
- `total_events` — events processed by this pipeline
- `success` — successful deliveries
- `failed` — failed deliveries
- `avg_response_time_ms` — average time from event creation to delivery attempt

Per-pipeline metrics are always accurate since they query the `events` and `deliveries` tables directly — no reset on restart.

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
