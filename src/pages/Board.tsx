import { useMemo, useState } from 'react';
import { analyze } from '../../shared/stats';
import { PLATFORM_IDS, type PlatformId, type Stage } from '../../shared/types';
import { TestCard } from '../components/TestCard';
import { useExperiments } from '../lib/api';
import { PLATFORM_NAMES, STAGES, fmtPct } from '../lib/format';
import { usePeeking } from '../lib/peeking';

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-line bg-card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="display num mt-1 text-4xl leading-none">{value}</div>
      <div className="mt-2 text-xs text-ink-500">{note}</div>
    </div>
  );
}

const selectClass =
  'rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink-900 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-teal-500';

export function Board() {
  const { data, isLoading, error } = useExperiments();
  const { peeking } = usePeeking();
  const [client, setClient] = useState('all');
  const [platform, setPlatform] = useState<'all' | PlatformId>('all');

  const analyzed = useMemo(() => (data ?? []).map((exp) => ({ exp, a: analyze(exp, { peeking }) })), [data, peeking]);
  const clients = useMemo(() => [...new Set((data ?? []).map((e) => e.clientName))].sort(), [data]);
  const filtered = analyzed.filter(({ exp }) => (client === 'all' || exp.clientName === client) && (platform === 'all' || exp.platform === platform));

  const by = (s: Stage) => filtered.filter((x) => x.a.stage === s);
  const served = by('served');
  const wins = served.filter((x) => x.exp.decision === 'winner').length;

  if (error) return <p className="text-berry-600">Could not load tests: {error.message}</p>;

  return (
    <div>
      <section className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-script text-2xl text-teal-500">Today's service</p>
          <h1 className="display mt-1 text-5xl leading-[1.05] sm:text-6xl">The Pass</h1>
          <p className="mt-3 max-w-xl text-ink-700">
            Every A/B test across every client and platform. A test is ready to taste after{' '}
            <strong className="font-medium text-ink-900">14 days</strong> and{' '}
            {peeking ? (
              <>
                <strong className="font-medium text-ink-900">90% confidence</strong> or its full planned sample.
              </>
            ) : (
              <>
                its <strong className="font-medium text-ink-900">full planned sample</strong>. Peeking is off, so significance is not checked early.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat label="Fermenting" value={String(by('fermenting').length)} note="Live, still collecting" />
        <Stat label="Ready to taste" value={String(by('ready').length)} note="Ready to call" />
        <Stat label="Served" value={String(served.length)} note="Called and documented" />
        <Stat label="Win rate" value={served.length ? fmtPct(wins / served.length, 0) : '—'} note={`${wins} of ${served.length} served tests`} />
      </section>

      <section className="mt-8 flex flex-wrap items-center gap-2" aria-label="Filters">
        <span className="eyebrow mr-1">Filter</span>
        <select aria-label="Client" className={selectClass} value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="all">All clients</option>
          {clients.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Platform" className={selectClass} value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId | 'all')}>
          <option value="all">All platforms</option>
          {PLATFORM_IDS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_NAMES[p]}
            </option>
          ))}
        </select>
        <span className="num ml-auto text-sm text-ink-500">{filtered.length} tests</span>
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Tests by stage">
        {STAGES.map((s) => {
          const items = by(s.id).sort((x, y) => y.a.days - x.a.days);
          return (
            <div key={s.id} className="flex flex-col">
              <header className="mb-3 flex items-end justify-between gap-2 border-b border-ink-900 pb-2">
                <div className="flex items-center gap-2">
                  <img src={`/art/${s.art}.svg`} alt="" className="h-6 w-6" />
                  <h2 className="display text-xl leading-none">{s.label}</h2>
                  <span className="font-script text-lg leading-none text-ink-400">{s.danish}</span>
                </div>
                <span className="num text-sm text-ink-500">{items.length}</span>
              </header>
              <div className="flex flex-col gap-3">
                {isLoading && <div className="h-32 animate-pulse rounded-md bg-wash" />}
                {!isLoading && items.length === 0 && (
                  <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-500">Nothing here right now.</div>
                )}
                {items.map(({ exp, a }) => (
                  <TestCard key={exp.id} exp={exp} analysis={a} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
