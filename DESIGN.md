# Design Document — Webhook Processing Pipeline

## Overview

A webhook hits a pipeline, the payload is transformed by an action, and the result is forwarded to one or more subscriber URLs. Core principle: ingestion is always fast, processing is always async, every failure is recorded and retried.

---

## Architecture

```
Client
  │  POST /webhooks/:pipelineId
  ▼
Express API
  │  1. Validate pipeline exists and is enabled
  │  2. Save event to DB
  │  3. Enqueue job via pg-boss
  │  4. Return 200 immediately
  ▼
PostgreSQL
  ▼
Background Worker (pg-boss)
  │  1. Fetch event → load pipeline → resolve action
  │  2. Execute action on payload
  │  3. If skipped → log and stop
  │  4. Check rate limit per subscriber
  │  5. POST result to each subscriber URL
  │  6. Record delivery attempt (success or failed)
  │  7. Retry up to retry_limit times with exponential backoff
  │  8. Record metrics
  ▼
Subscriber endpoints
```

Ingestion and delivery are fully decoupled — the API accepts the webhook and returns immediately, the worker handles delivery in the background. If a subscriber is slow or offline, the sender never sees an error and no webhooks are lost.

---

## Project Structure

```
webhook-pipeline/
├── src/                    # Backend source
│   ├── app.ts              # Express app, middleware, route registration
│   ├── server.ts           # Bootstrap: DB check, queue init, http.listen
│   ├── config/
│   │   ├── database.ts     # pg connection pool
│   │   └── env.ts          # Typed environment variables
│   ├── lib/
│   │   └── logger.ts       # Pino logger instance
│   ├── metrics/
│   │   └── metrics.ts      # In-memory metrics store
│   ├── middleware/
│   │   ├── auth.ts         # API key authentication
│   │   └── error.ts        # Typed error classes + global error handler
│   ├── modules/
│   │   ├── pipeline/       # CRUD, toggle, per-pipeline metrics
│   │   ├── webhook/        # Ingestion endpoint + event status
│   │   ├── subscriber/     # Subscriber management per pipeline
│   │   ├── delivery/       # Delivery history and manual retry
│   │   └── metrics/        # GET /metrics route
│   ├── queue/
│   │   ├── boss.ts         # pg-boss instance
│   │   └── worker.ts       # Job processor: action, delivery, retry, metrics
│   ├── actions/            # One file per action type + shared interface
│   └── utils/
│       └── rateLimiter.ts  # In-memory token bucket rate limiter
├── dashboard/              # React + Vite + Tailwind frontend
│   └── src/
│       ├── api.ts          # All fetch calls to the backend
│       ├── App.tsx         # Router + sidebar layout
│       ├── components/
│       │   └── shared.tsx  # StatusBadge, PipelineTabs, groupBySubscriber, calcEventStatus
│       └── pages/
│           ├── Overview.tsx
│           ├── Events.tsx
│           └── Deliveries.tsx
├── db/
│   └── migrations/         # SQL migration files (run on startup)
├── dockerfile
├── docker-compose.yml
└── docker-entrypoint.sh    # Runs migrations then starts the server
```

Each backend module owns its controller, service, repository, routes, and types. No module accesses another module's repository directly.

---

## Database Schema

### `pipelines`
| Column         | Type      | Notes                                          |
|----------------|-----------|------------------------------------------------|
| id             | SERIAL    | Primary key                                    |
| name           | TEXT      |                                                |
| action_type    | TEXT      | Registered action identifier                   |
| action_options | JSONB     | Action config (fields, secret, rate_limit)     |
| enabled        | BOOLEAN   | Default true                                   |
| retry_limit    | INT       | Max delivery attempts (default 3)              |
| timeout_ms     | INT       | HTTP timeout per attempt (default 5000ms)      |
| created_at     | TIMESTAMP |                                                |

### `subscribers`
| Column      | Type      | Notes          |
|-------------|-----------|----------------|
| id          | SERIAL    | Primary key    |
| pipeline_id | INT       | FK → pipelines |
| target_url  | TEXT      |                |
| created_at  | TIMESTAMP |                |

### `events`
| Column      | Type      | Notes                                 |
|-------------|-----------|---------------------------------------|
| id          | SERIAL    | Primary key                           |
| pipeline_id | INT       | FK → pipelines                        |
| payload     | JSONB     | Raw incoming webhook body             |
| status      | TEXT      | queued / processed / skipped / failed |
| result      | JSONB     | Output after action execution         |
| created_at  | TIMESTAMP |                                       |

### `deliveries`
| Column        | Type      | Notes                       |
|---------------|-----------|-----------------------------|
| id            | SERIAL    | Primary key                 |
| event_id      | INT       | FK → events                 |
| subscriber_id | INT       | FK → subscribers            |
| status        | TEXT      | pending / success / failed  |
| response_code | INT       | HTTP status from subscriber |
| response_body | TEXT      |                             |
| attempt       | INT       | Attempt number (1-N)        |
| last_attempt  | TIMESTAMP |                             |

---

## Error Handling

Errors are typed and thrown from the service layer. A global handler in `error.ts` catches them and returns a consistent JSON response.

Controllers call the service layer and pass any error to `next(err)`. The service throws typed errors (`NotFoundError`, `ValidationError`, etc.). The global error handler in `error.ts` catches them and returns a consistent `{ error: message }` response with the correct status code. Controllers never set HTTP status directly.

---

## Technology Decisions

### Express over NestJS
Express gives full control with minimal overhead. NestJS adds conventions and boilerplate that aren't justified at this scale.

### pg-boss over Redis/BullMQ
Runs on PostgreSQL — no extra infrastructure. Jobs are durable and visible in the same DB as application data.

### Pino over Winston
Faster on the hot path. Raw JSON in production, pino-pretty in development. Winston's extra configurability comes at a performance cost that isn't needed here.

### axios over fetch
Built-in `timeout` option. Without it, a slow subscriber blocks the worker indefinitely. `fetch` needs an `AbortController` for the same result.

### JSONB for payloads
Webhook payloads have no fixed schema — every sender sends something different. JSONB stores them as-is without requiring a predefined structure, and keeps the door open for querying payload fields later.

### Worker in the same process as the API
Instead of running the background worker as a separate service, it starts inside the same Node.js process as the API. This keeps the setup simple — one container, one process. It works safely because pg-boss uses DB-level locking to ensure jobs aren't picked up twice. The tradeoff: if the worker becomes heavy, it shares CPU with the API. At this scale that's not a concern.

---

## Action Design

Actions implement a single interface: `execute(payload): Promise<any>`. Stateless, no dependencies, resolved by action type string at runtime via `getAction()`. Adding a new action = one file + one line in `index.ts`.

`getAction()` throws `ValidationError` for unknown types — invalid pipelines are rejected at creation time.

| Action           | What it does |
|------------------|--------------|
| `addTimestamp`   | Appends `processedAt` (ISO) to the payload |
| `transformKeys`  | Renames fields using `_keyMap` in the payload (stripped from output) |
| `filter`         | Skips delivery if `_filter.field !== _filter.value` |
| `maskSensitive`  | Replaces sensitive fields with `***` — default: password, token, secret, email, phone, ssn |
| `addSignature`   | Computes HMAC-SHA256 over the payload, sends it as `X-Webhook-Signature` header |

---

## Logging

Uses [pino](https://github.com/pinojs/pino) — structured JSON logger. In development (`NODE_ENV=development`), pino-pretty formats logs for readability:

```
[15:12:35] INFO: request completed
    req: { "method": "POST", "url": "/webhooks/1" }
    res: { "statusCode": 200 }
    responseTime: 24

[15:12:35] INFO: Event delivered
    eventId: 42  subscriberId: 3  attempt: 1

[15:12:36] WARN: Delivery failed
    eventId: 42  subscriberId: 3  attempt: 2  err: "ECONNREFUSED"
```

In production, raw JSON is emitted for log aggregators (Datadog, Grafana, ELK). HTTP requests are logged automatically via `pino-http` middleware.

Log levels: `info` (normal ops), `warn` (failures, skips, rate limits), `error` (unhandled errors, all retries exhausted).

---

## Retry & Backoff

Delivery is attempted up to `retry_limit` times (default 3) with exponential backoff (`2000ms × attempt`). Every attempt is written to the `deliveries` table with status, HTTP code, and response body. Both `retry_limit` and `timeout_ms` are configurable per pipeline.

---

## Rate Limiting

Per-subscriber, configurable via `action_options.rate_limit` (`max` requests per `window_ms`). In-memory token bucket — no Redis needed. Deliveries that exceed the limit are skipped and logged.

---

## Metrics

**System-wide** (`GET /metrics`) — in-memory, resets on restart:
- `total_events`, `success_deliveries`, `failed_deliveries`, `retries`, `avg_response_time_ms`

**Per-pipeline** (`GET /pipelines/:id/metrics`) — live from DB, persists across restarts:
- `total_events`, `success`, `failed`, `avg_response_time_ms`

---

## Dashboard

React + Vite + Tailwind in `dashboard/`. Connects to the backend via Vite dev proxy (`/api` → `http://localhost:3000`).

- **Overview** — metrics cards + pipeline table with toggle
- **Events** — event list with status; click to inspect payload and per-subscriber delivery breakdown
- **Deliveries** — grouped by event + subscriber, expandable attempt rows per session, retry button with polling

Status is based on each subscriber's last attempt — not whether any attempt ever succeeded. Sessions are separated by attempt resets (each manual retry starts a new session).

---

## Design Trade-offs (Intentional Simplifications)

The system is intentionally designed with minimal infrastructure to keep the implementation simple and easy to reason about for a demo environment. The following trade-offs highlight what would change in a production-scale deployment.

| Area | Current | Production approach |
|------|---------|-------------------|
| Actions | One action per pipeline | `pipeline_steps` table with ordered chaining |
| Action config | `_keyMap` and `_filter` live in the payload — sender controls behavior | Config belongs in the pipeline definition |
| Rate limiter | In-memory, resets on restart, single instance only | Redis for distributed limiting |
| Global metrics | In-memory, resets on restart | Prometheus or a time-series DB |
| Failed deliveries | Marked failed in DB, no alerting | Dead letter queue with alerting |
| Inbound security | Signature verification omitted to reduce demo complexity | HMAC-SHA256 validation per pipeline |

---

## Production Evolution Roadmap

- Verify inbound webhook signatures (HMAC-SHA256) to prevent spoofed events
- Move permanently failed deliveries to a dead letter queue with alerting
- Replace in-memory rate limiter and metrics with Redis + Prometheus
- Support action chaining via a `pipeline_steps` table
