import { useEffect, useState } from 'react';
import { getPipelines, getSystemMetrics, togglePipeline } from '../api';


type Metrics = {
  total_events: number;
  success_deliveries: number;
  failed_deliveries: number;
  avg_response_time_ms: number;
};

type Pipeline = {
  id: number;
  name: string;
  enabled: boolean;
  action_type: string;
};


function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-3xl font-semibold ${color}`}>{value}</span>
    </div>
  );
}


export default function Overview() {
  const [metrics,   setMetrics]   = useState<Metrics | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  const load = async () => {
    const [m, p] = await Promise.all([getSystemMetrics(), getPipelines()]);
    setMetrics(m);
    setPipelines(p);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: number) => {
    await togglePipeline(id);
    load();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-800">Overview</h1>

      {/* Metrics cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Events"            value={metrics.total_events}          color="text-gray-800"  />
          <MetricCard label="Successful Deliveries"   value={metrics.success_deliveries}    color="text-green-600" />
          <MetricCard label="Failed Deliveries"       value={metrics.failed_deliveries}     color="text-red-500"   />
          <MetricCard label="Avg Response"            value={`${metrics.avg_response_time_ms}ms`} color="text-blue-600"  />
        </div>
      )}

      {/* Pipelines table */}
      <div>
        <h2 className="text-lg font-medium text-gray-700 mb-3">Pipelines</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pipelines.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.action_type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {p.enabled ? '● Active' : '○ Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(p.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        p.enabled
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {p.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {pipelines.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No pipelines yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
