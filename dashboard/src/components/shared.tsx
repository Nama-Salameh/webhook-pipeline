export type Pipeline = {
  id: number;
  name: string;
};

export type Delivery = {
  id: number;
  event_id: number;
  subscriber_id: number;
  status: string;
  response_code: number;
  attempt: number;
  last_attempt: string;
};

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  failed:  'bg-red-100 text-red-600',
  partial: 'bg-orange-100 text-orange-600',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-yellow-100 text-yellow-700';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}


export function PipelineTabs({ pipelines, selected, onSelect }: {
  pipelines: Pipeline[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {pipelines.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === p.id
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}


export function groupBySubscriber(rows: Delivery[]): Map<number, Delivery[][]> {
  const bySubscriber = new Map<number, Delivery[]>();

  for (const r of rows) {
    if (!bySubscriber.has(r.subscriber_id)) bySubscriber.set(r.subscriber_id, []);
    bySubscriber.get(r.subscriber_id)!.push(r);
  }

  const result = new Map<number, Delivery[][]>();

  for (const [sid, deliveries] of bySubscriber.entries()) {
    const sorted = [...deliveries].sort(
      (a, b) => new Date(a.last_attempt).getTime() - new Date(b.last_attempt).getTime()
    );

    const sessions: Delivery[][] = [];
    let current: Delivery[] = [];

    for (const d of sorted) {
      if (d.attempt === 1 && current.length > 0) {
        sessions.push(current);
        current = [];
      }
      current.push(d);
    }

    if (current.length > 0) sessions.push(current);
    result.set(sid, sessions);
  }

  return result;
}



export function calcEventStatus(deliveries: Delivery[]): string {
  const subs = [...new Set(deliveries.map(d => d.subscriber_id))];
  const results = subs.map(sid => {
    const sorted = deliveries
      .filter(d => d.subscriber_id === sid)
      .sort((a, b) => new Date(a.last_attempt).getTime() - new Date(b.last_attempt).getTime());
    return sorted.at(-1)?.status ?? 'pending';
  });
  if (results.every(r => r === 'success')) return 'success';
  if (results.every(r => r === 'failed'))  return 'failed';
  return 'partial';
}
