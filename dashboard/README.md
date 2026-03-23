# Webhook Pipeline — Dashboard

![React](https://img.shields.io/badge/react-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/vite-6-purple?logo=vite)
![Tailwind](https://img.shields.io/badge/tailwind-4-teal?logo=tailwindcss)

A monitoring dashboard for the Webhook Processing Pipeline. Designed for demo and development environments — it prioritizes clarity and visibility over full production management features.

---

## Scope

This dashboard is intentionally minimal and focused on observability. It lets operators:

- monitor pipeline activity and system metrics
- inspect events and their delivery status per subscriber
- retry failed webhook deliveries

Pipeline creation and configuration are performed via the API. This is a deliberate choice — not a missing feature.

---

## Pages

### Overview
- System-wide metrics: total events, delivered, undelivered, avg response time
- Pipelines table with enable/disable toggle

### Events
- Per-pipeline event list with computed status (`success`, `failed`, `partial`)
- Click any event to inspect its payload and full delivery breakdown per subscriber

### Deliveries
- Per-pipeline delivery list grouped by event and subscriber
- Expandable rows showing individual attempts per session
- Retry button for failed deliveries with live polling until result appears

---

## Getting Started

```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173`. The backend must be running — see the root [README](../README.md).

### Build

```bash
npm run build
```

Output goes to `dist/`.

---

## Configuration

The API key in `src/api.ts` must match `API_KEY` on the backend:

```ts
const API_KEY = 'webhook-secret-123';
```

Vite proxies `/api/*` → `http://localhost:3000/*` to avoid CORS in dev. See `vite.config.ts`.

---

## Architecture

The dashboard is a static React application that communicates directly with the backend API. No server-side rendering or backend-for-frontend layer is used.
