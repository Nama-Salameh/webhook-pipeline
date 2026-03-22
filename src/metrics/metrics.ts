const metrics = {
  totalEvents: 0,
  successDeliveries: 0,
  failedDeliveries: 0,
  totalResponseTime: 0,
  deliveryCount: 0,
  retries: 0,
};

export const recordEvent = () => { metrics.totalEvents++; };
export const recordSuccess = (duration: number) => {
  metrics.successDeliveries++;
  metrics.totalResponseTime += duration;
  metrics.deliveryCount++;
};
export const recordFailure = () => { metrics.failedDeliveries++; };
export const recordRetry = () => { metrics.retries++; };

export const getMetrics = () => ({
  total_events: metrics.totalEvents,
  success_deliveries: metrics.successDeliveries,
  failed_deliveries: metrics.failedDeliveries,
  retries: metrics.retries,
  avg_response_time_ms: metrics.deliveryCount === 0
    ? 0
    : Math.round(metrics.totalResponseTime / metrics.deliveryCount),
});
