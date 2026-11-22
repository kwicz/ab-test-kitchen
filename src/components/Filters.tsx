import { useMemo, useState } from 'react';
import { analyze, type Analysis } from '../../shared/stats';
import { PLATFORM_IDS, type Experiment, type PlatformId } from '../../shared/types';
import { PLATFORM_NAMES } from '../lib/format';
import { usePeeking } from '../lib/peeking';

export interface Row {
  exp: Experiment;
  a: Analysis;
}

/** Analyze every test for the current peeking mode and apply client/platform filters. */
export function useFilteredTests(data: Experiment[] | undefined) {
  const { peeking } = usePeeking();
  const [client, setClient] = useState('all');
  const [platform, setPlatform] = useState<'all' | PlatformId>('all');

  const analyzed = useMemo<Row[]>(() => (data ?? []).map((exp) => ({ exp, a: analyze(exp, { peeking }) })), [data, peeking]);
  const clients = useMemo(() => [...new Set((data ?? []).map((e) => e.clientName))].sort(), [data]);
  const rows = analyzed.filter(({ exp }) => (client === 'all' || exp.clientName === client) && (platform === 'all' || exp.platform === platform));

  return { rows, clients, client, setClient, platform, setPlatform };
}

export const selectClass =
  'rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink-900 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-teal-500';

export function Filters({ f, count, children }: { f: ReturnType<typeof useFilteredTests>; count: number; children?: React.ReactNode }) {
  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="Filters">
      <span className="eyebrow mr-1">Filter</span>
      <select aria-label="Client" className={selectClass} value={f.client} onChange={(e) => f.setClient(e.target.value)}>
        <option value="all">All clients</option>
        {f.clients.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select aria-label="Platform" className={selectClass} value={f.platform} onChange={(e) => f.setPlatform(e.target.value as PlatformId | 'all')}>
        <option value="all">All platforms</option>
        {PLATFORM_IDS.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_NAMES[p]}
          </option>
        ))}
      </select>
      {children}
      <span className="num ml-auto text-sm text-ink-500">{count} tests</span>
    </section>
  );
}
