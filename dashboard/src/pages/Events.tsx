import { useEffect, useState } from 'react';
import { getPipelines, getDeliveries, getEventStatus } from '../api';
import {
  type Pipeline,
  type Delivery,
  StatusBadge,
  PipelineTabs,
  groupBySubscriber,
  calcEventStatus,
} from '../components/shared';


export default function Events() {
  const [pipelines,  setPipelines]  = useState<Pipeline[]>([]);
  const [selected,   setSelected]   = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [detail,     setDetail]     = useState<{ event: any; deliveries: Delivery[] } | null>(null);

  useEffect(() => {
    getPipelines().then(p => {
      setPipelines(p);
      if (p.length > 0) setSelected(p[0].id);
    });
  }, []);

  useEffect(() => {
    if (selected) getDeliveries(selected).then(setDeliveries);
  }, [selected]);

  const eventIds = [...new Set(deliveries.map(d => d.event_id))];

  const handleTabSelect = (id: number) => {
    setSelected(id);
    setDetail(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Events</h1>

      <PipelineTabs pipelines={pipelines} selected={selected} onSelect={handleTabSelect} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Event list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-600">
            Click to inspect
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Max Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eventIds.map(eventId => {
                const rows = deliveries.filter(d => d.event_id === eventId);
                return (
                  <tr
                    key={eventId}
                    onClick={() => getEventStatus(eventId).then(setDetail)}
                    className="hover:bg-indigo-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-indigo-600 font-medium">#{eventId}</td>
                    <td className="px-4 py-3"><StatusBadge status={calcEventStatus(rows)} /></td>
                    <td className="px-4 py-3 text-gray-500">
                      {Math.max(...rows.map(d => d.attempt))}
                    </td>
                  </tr>
                );
              })}
              {eventIds.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No events yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Event detail panel */}
        {detail && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-800">Event #{detail.event.id}</h3>
              <StatusBadge status={calcEventStatus(detail.deliveries)} />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Payload</p>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto max-h-32 text-gray-700">
                {JSON.stringify(detail.event.payload, null, 2)}
              </pre>
            </div>

            <div className="space-y-3">
              {Array.from(groupBySubscriber(detail.deliveries).entries()).map(([subId, sessions]) => {
                const subStatus = sessions.flat()
                  .sort((a, b) => new Date(a.last_attempt).getTime() - new Date(b.last_attempt).getTime())
                  .at(-1)?.status ?? 'pending';
                return (
                  <div key={subId} className="border border-gray-100 rounded-lg overflow-hidden">
                    {/* Subscriber header */}
                    <div className={`flex items-center justify-between px-3 py-2 text-xs font-medium ${
                      subStatus === 'success' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <span className="text-gray-600">Subscriber #{subId}</span>
                      <StatusBadge status={subStatus} />
                    </div>

                    {/* Sessions + attempts */}
                    {sessions.map((session, si) => (
                      <div key={si}>
                        {sessions.length > 1 && (
                          <div className="px-3 py-1 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
                            Session {si + 1}
                          </div>
                        )}
                        {session.map(r => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between px-3 py-1.5 text-xs border-t border-gray-100"
                          >
                            <span className="text-gray-400">Attempt {r.attempt}</span>
                            <StatusBadge status={r.status} />
                            <span className="text-gray-400">{r.response_code ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
