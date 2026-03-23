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
  │  1. Validate pipeline exists and is enabled
  │  2. Save event to DB
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
  │  5. Check rate limit per subscriber
  │  6. POST result to each subscriber URL
  │  7. Record delivery attempt (success or failed)
  │  8. Retry up to retry_limit times with exponential backoff
  │  9. Record metrics on each attempt
  ▼
Subscriber endpoints
```

The API and the worker are decoupled — the HTTP layer never waits for processing or delivery. A slow or unavailable subscriber has zero impact on webhook ingestion.

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
│   └── metrics.ts          # In-memory metrics store (written by worker, read by API)
├── lib/
│   └── logger.ts           # Pino logger instance (shared across app and worker)
├── middleware/
│   ├── auth.ts             # API key authentication middleware
│   └── error.ts            # Typed error classes + global error handler
├── modules/
│   ├── pipeline/           # CRUD, toggle, per-pipeline metrics
│   ├── webhook/            # Ingestion endpoint + event status
│   ├── subscriber/         # Subscriber management per pipeline
│   ├── delivery/           # Delivery history and manual retry
│   └── metrics/            # GET /metrics controller and routes
├── queue/
│   ├── boss.ts             # pg-boss instance and queue setup
│   └── worker.ts           # Job processor: action execution, delivery, retry, metrics
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

Each module owns its controller, service, repository, routes, and types. No module reaches into another module's repository directly — cross-module data access goes through the service layer.

---

## Database Schema

### `pipelines`
| Column         | Type      | Notes                                          |
|----------------|-----------|------------------------------------------------|
| id             | SERIAL    | Primary key                                    |
| name           | TEXT      | Pipeline name                                  |
| action_type    | TEXT      | Registered action identifier                   |
| action_options | JSONB     | Action config (fields, secret, rate_limit)     |
| enabled        | BOOLEAN   | Whether pipeline accepts events (default true) |
| retry_limit    | INT       | Max delivery attempts (default 3)              |
| timeout_ms     | INT       | HTTP timeout per attempt (default 5000ms)      |
| created_at     | TIMESTAMP |                                                |

### `subscribers`
| Column      | Type      | Notes           |
|-------------|-----------|-----------------|
| id          | SERIAL    | Primary key     |
| pipeline_id | INT       | FK → pipelines  |
| target_url  | TEXT      | Destination URL |
| created_at  | TIMESTAMP |                 |

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
| Column        | Type      | Notes                         |
|---------------|-----------|-------------------------------|
| id            | SERIAL    | Primary key                   |
| event_id      | INT       | FK → events                   |
| subscriber_id | INT       | FK → subscribers              |
| status        | TEXT      | pending / success / failed    |
| response_code | INT       | HTTP status from subscriber   |
| response_body | TEXT      | Response body from subscriber |
| attempt       | INT       | Attempt number (1-N)          |
| last_attempt  | TIMESTAMP |                               |

---

## Error Handling

Errors are typed and thrown from the service layer. A global error handler middleware in `error.ts` catches them and returns a consistent JSON response.

```
Controller → calls service
Service    → throws typed error (NotFoundError, ValidationError, UnauthorizedError)
Middleware → catches via next(err), returns { error: message } with correct status
```

Error classes:

| Class               | Status | Default message    |
|---------------------|--------|--------------------|
| `AppError`          | 500    | base class         |
| `NotFoundError`     | 404    | "Not found"        |
| `ValidationError`   | 400    | "Validation error" |
| `UnauthorizedError` | 401    | "Unauthorized"     |

This avoids duplicated status-code logic across controllers. Controllers only call `next(err)` — they never decide the HTTP status themselves.

All controllers follow this pattern consistently, including `webhook.controller.ts`.

---

## Technology Decisions

### Authentication
API key auth via `x-api-key` header. Configured via the `API_KEY` env var. If `API_KEY` is not set, the middleware passes all requests through — auth is opt-in. The webhook ingestion endpoint (`POST /webhooks/:pipelineId`) and `GET /health` are always public. All management endpoints require the key when set.

### Express over NestJS
Express is minimal and gives full control over structure. NestJS enforces its own conventions and adds significant boilerplate — the overhead isn't justified at this scale.

### PostgreSQL
Handles both relational data (pipelines, subscribers) and schema-less data (event payloads, delivery responses) via JSONB. No need for a separate document store. It's also the backing store for pg-boss, keeping the infrastructure footprint small.

### pg-boss over Redis/BullMQ
pg-boss runs entirely on PostgreSQL — no additional broker needed. Jobs are durable (survive restarts), visible in the same DB as application data, and the queue semantics (retry, dead letter, concurrency) are sufficient for this use case.

### Pino over Winston
Pino is significantly faster than Winston because it does minimal work on the hot path — serialization is offloaded to a worker thread via `pino-pretty` in dev, and raw JSON is emitted in production with near-zero overhead. Winston is more configurable but that flexibility comes at a performance cost that isn't needed here. Pino is also the standard choice in the Fastify ecosystem and increasingly in Express projects that care about throughput — which aligns with a webhook platform that can process high event volumes.


Built-in `timeout` support is the key reason. Without a timeout, a slow subscriber blocks the worker thread indefinitely. `fetch` in Node.js requires an `AbortController` and manual wiring — axios does it in one option.

### JSONB for payloads
Webhook payloads are schema-less by nature. JSONB stores them without requiring a fixed schema, supports GIN indexing for future querying, and allows the application to work with the data as a plain object without any deserialization step.

### Worker in the same process as the API
The background worker runs inside the same Node.js process as the Express server. For this scale, the overhead of a second container isn't justified. pg-boss handles concurrency and job locking at the DB level, so running the worker in-process is safe. Splitting it out would be the right call if the worker became CPU-bound or needed independent scaling.

### Docker setup
Multi-stage Dockerfile — the builder stage compiles TypeScript, the final stage copies only compiled output and production dependencies. A `docker-entrypoint.sh` runs migrations before starting the server, so `docker compose up --build` is the only command needed from scratch.

### webhook.site for testing
When the API runs inside Docker, `localhost` inside the container refers to the container itself — not the host machine. webhook.site is a public URL the container can reach without any networking workarounds, and provides a visual inspector for verifying delivered payloads.

---

## Action Design

Actions implement a single interface: `execute(payload): Promise<any>`. They are stateless, have no dependencies, and are resolved by action type string at runtime via `getAction()`. Adding a new action means creating one file and registering it in `index.ts`.

`getAction()` throws a `ValidationError` for unknown action types — enforced at pipeline creation time, so invalid pipelines are rejected immediately.

### `addTimestamp`
Appends `processedAt` (ISO timestamp) to the payload. Zero side effects, always succeeds.

### `transformKeys`
Renames payload fields using a `_keyMap` passed in the payload. The `_keyMap` key is stripped from the output. Solves a common real-world problem: systems that produce and consume webhooks often use different naming conventions.

### `filter`
Checks a single field condition (`_filter.field === _filter.value`). If the condition is not met, returns `{ skipped: true }` — the worker logs the reason and stops, no delivery is attempted. The `_filter` key is stripped from the forwarded payload when the condition passes.

### `maskSensitive`
Replaces known sensitive fields with `***` before delivery. Default masked fields: `password`, `token`, `secret`, `email`, `phone`, `ssn` (case-insensitive). Prevents credentials from being forwarded to subscriber URLs in plaintext. Customizable via `action_options.fields` and `action_options.mask`.

### `addSignature`
Appends a `timestamp` (ISO) and computes an HMAC-SHA256 signature over the full payload including the timestamp. The signature is stripped from the body and sent as an `X-Webhook-Signature` header — the standard pattern used by Stripe and GitHub. Subscribers verify the header to confirm authenticity. Secret is set via `action_options.secret` or falls back to the `WEBHOOK_SECRET` env var.

---

## Logging

All logging uses [pino](https://github.com/pinojs/pino) — a structured JSON logger. Every log line is a JSON object with consistent fields, making logs filterable and machine-readable.

```json
{ "level": 30, "time": 1710000000000, "eventId": 42, "subscriberId": 3, "attempt": 1, "msg": "Event delivered" }
{ "level": 40, "time": 1710000000000, "eventId": 42, "subscriberId": 3, "err": "ECONNREFUSED", "msg": "Delivery failed" }
```

HTTP requests are logged automatically via `pino-http` middleware in `app.ts` — every request gets a log line with method, URL, status, and response time.

In development (`NODE_ENV=development`), logs are formatted with `pino-pretty` for readability. In production, raw JSON is emitted for ingestion by log aggregators (Datadog, Grafana, ELK).

Log levels used:
- `info` — normal operations (server start, job start, delivery success)
- `warn` — skipped events, rate limit hits, failed delivery attempts
- `error` — unhandled errors, all delivery attempts exhausted

---



Delivery is attempted up to `retry_limit` times per subscriber (default 3) with exponential backoff (`2000ms x attempt`). Both `retry_limit` and `timeout_ms` are configurable per pipeline at creation time. Every attempt — success or failure — is written to the `deliveries` table with the HTTP status code and response body.

Retrying gives the subscriber a chance to recover from transient failures (deploys, timeouts, momentary overload). Exponential backoff avoids hammering an already-struggling endpoint.

---

## Rate Limiting

Per-subscriber rate limiting is configurable via `action_options.rate_limit` (`max` requests per `window_ms`). Implemented as an in-memory token bucket — no Redis needed. If a subscriber exceeds the limit within the window, the delivery is skipped and logged.

This prevents a single slow or misbehaving subscriber from being hammered during high-volume event bursts.

---

## Metrics

Two levels:

**System-wide** (`GET /metrics`) — in-memory counters tracked by the worker:
- `total_events` — events picked up by the worker
- `success_deliveries` — successful HTTP deliveries
- `failed_deliveries` — failed delivery attempts
- `retries` — retry attempts made
- `avg_response_time_ms` — average delivery response time

Resets on server restart. For production these would be persisted to a time-series store (Prometheus + Grafana).

**Per-pipeline** (`GET /pipelines/:id/metrics`) — aggregated live from the DB:
- `total_events` — events processed by this pipeline
- `success` — successful deliveries
- `failed` — failed deliveries
- `avg_response_time_ms` — average time from event creation to delivery attempt

Per-pipeline metrics are always accurate since they query the `events` and `deliveries` tables directly — no reset on restart.

---

## Trade-offs and Limitations

- **Single action per pipeline** — supporting chained actions would require a `pipeline_steps` table and sequential execution.
- **Inline action config** — `_keyMap` and `_filter` live in the payload, coupling config to the event. A dedicated config column per pipeline step would be cleaner for production.
- **In-memory rate limiter** — resets on restart and does not work across multiple instances. Redis would be needed for distributed rate limiting.
- **In-memory global metrics** — reset on restart. Production would use Prometheus or a time-series DB.
- **No dead letter queue** — after max retries the delivery is marked failed and stays in the DB. A DLQ with alerting would be the production approach.
- **No incoming signature verification** — HMAC-SHA256 validation on incoming requests would prevent spoofed events.


---

## What I'd Do Differently in Production

- Validate incoming webhook signatures (HMAC-SHA256) to prevent spoofed events
- Move failed deliveries to a dead letter queue after max retries
- Use Redis for distributed rate limiting and persistent metrics
- Add pipeline step chaining via a `pipeline_steps` table
