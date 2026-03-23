const API_KEY = 'webhook-secret-123';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};


const base = import.meta.env.VITE_API_URL ?? '/api';

export const getPipelines = () =>
  fetch(`${base}/pipelines`, { headers }).then(r => r.json());

export const togglePipeline = (id: number) =>
  fetch(`${base}/pipelines/${id}/toggle`, { method: 'PATCH', headers }).then(r => r.json());

export const getPipelineMetrics = (id: number) =>
  fetch(`${base}/pipelines/${id}/metrics`, { headers }).then(r => r.json());

export const getSystemMetrics = () =>
  fetch(`${base}/metrics`, { headers }).then(r => r.json());

export const getDeliveries = (pipelineId: number) =>
  fetch(`${base}/deliveries/pipeline/${pipelineId}`, { headers }).then(r => r.json());

export const retryDelivery = (id: number) =>
  fetch(`${base}/deliveries/${id}/retry`, { method: 'POST', headers }).then(r => r.json());

export const getEventStatus = (id: number) =>
  fetch(`${base}/events/${id}/status`, { headers }).then(r => r.json());

export const getSubscribers = (pipelineId: number) =>
  fetch(`${base}/pipelines/${pipelineId}/subscribers`, { headers }).then(r => r.json());
