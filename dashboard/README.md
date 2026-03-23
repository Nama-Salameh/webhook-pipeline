# Webhook Pipeline — Dashboard

![React](https://img.shields.io/badge/react-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/typescript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/vite-6-purple?logo=vite)
![Tailwind](https://img.shields.io/badge/tailwind-4-teal?logo=tailwindcss)

A monitoring dashboard for the Webhook Processing Pipeline. Provides real-time visibility into events, deliveries, and pipeline health.

---

## Pages

### Overview
- System-wide metrics: total events, successful/failed deliveries, avg response time
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

The dashboard runs as a static frontend proxied through Vite to the backend API on `http://localhost:3000`.

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
