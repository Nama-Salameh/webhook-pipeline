import { useEffect, useRef, useState } from 'react';
import { getPipelines, getDeliveries, retryDelivery } from '../api';
import {
  type Pipeline,
  type Delivery,
  StatusBadge,
  PipelineTabs,
  groupBySubscriber,
} from '../components/shared';


type Group = {
  key: string;
  event_id: number;
  subscriber_id: number;
  finalStatus: string;
  totalAttempts: number;
  lastTime: string;
  lastCode: number;
  lastId: number;
  sessions: Delivery[][];
};


function buildGroups(deliveries: Delivery[]): Group[] {
  const groups: Group[] = [];
  const eventIds = [...new Set(deliveries.map(d => d.event_id))];

  for (const eventId of eventIds) {
    const bySubscriber = groupBySubscriber(deliveries.filter(d => d.event_id === eventId));

    for (const [subId, sessions] of bySubscriber.entries()) {
      const all    = sessions.flat();
      const latest = sessions[sessions.length - 1].at(-1)!;

      groups.push({
        key:           `${eventId}-${subId}`,
        event_id:      eventId,
        subscriber_id: subId,
        finalStatus:   sessions[sessions.length - 1].at(-1)!.status,
        totalAttempts: all.length,
        lastTime:      latest.last_attempt,
        lastCode:      latest.response_code,
        lastId:        latest.id,
        sessions,
      });
    }
  }

  return groups.sort((a, b) => b.event_id - a.event_id);
}


const HEADERS = ['Event', 'Subscriber', 'Status', 'Code', 'Attempts', 'Time', 'Action'];

export default function Deliveries() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selected,  setSelected]  = useState<number | null>(null);
  const [groups,    setGroups]    = useState<Group[]>([]);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [retrying,  setRetrying]  = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = (id: number) =>
    getDeliveries(id).then(d => setGroups(buildGroups(d)));

  useEffect(() => {
    getPipelines().then(p => {
      setPipelines(p);
      if (p.length > 0) { setSelected(p[0].id); load(p[0].id); }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleTabSelect = (id: number) => {
    setSelected(id);
    load(id);
    setExpanded(null);
  };

  const handleRetry = async (deliveryId: number) => {
    setRetrying(deliveryId);
    await retryDelivery(deliveryId);
    let count = 0;
    pollRef.current = setInterval(async () => {
      if (selected) await load(selected);
      if (++count >= 15) { clearInterval(pollRef.current!); setRetrying(null); }
    }, 1500);
  };

  const toggleExpand = (key: string) =>
    setExpanded(prev => (prev === key ? null : key));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Deliveries</h1>

      <PipelineTabs pipelines={pipelines} selected={selected} onSelect={handleTabSelect} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              {HEADERS.map(h => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map(g => (
              <>
                {/* Summary row */}
                <tr
                  key={g.key}
                  onClick={() => g.totalAttempts > 1 && toggleExpand(g.key)}
                  className={`hover:bg-gray-50 ${g.totalAttempts > 1 ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-500">#{g.event_id}</td>
                  <td className="px-4 py-3 text-gray-500">#{g.subscriber_id}</td>
                  <td className="px-4 py-3"><StatusBadge status={g.finalStatus} /></td>
                  <td className="px-4 py-3 text-gray-500">{g.lastCode ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {g.totalAttempts}
                    {g.totalAttempts > 1 && (
                      <span className="ml-1 text-gray-400 text-xs">
                        {expanded === g.key ? '▲' : '▼'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(g.lastTime).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    {g.finalStatus === 'failed' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRetry(g.lastId); }}
                        disabled={retrying === g.lastId}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {retrying === g.lastId ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>

                {/* Expanded attempt rows */}
                {expanded === g.key && g.sessions.map((session, si) => (
                  <>
                    {g.sessions.length > 1 && (
                      <tr key={`s-${si}`} className="bg-gray-100 text-xs text-gray-400">
                        <td className="px-4 py-1 pl-8" colSpan={7}>Session {si + 1}</td>
                      </tr>
                    )}
                    {session.map(r => (
                      <tr key={r.id} className="bg-gray-50 text-xs text-gray-400">
                        <td className="px-4 py-2 pl-8" colSpan={2}>attempt {r.attempt}</td>
                        <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-2">{r.response_code ?? '—'}</td>
                        <td />
                        <td className="px-4 py-2">{new Date(r.last_attempt).toLocaleTimeString()}</td>
                        <td />
                      </tr>
                    ))}
                  </>
                ))}
              </>
            ))}

            {groups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No deliveries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
