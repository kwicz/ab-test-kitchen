import type { Stage } from '../../shared/types';
import { Filters, useFilteredTests } from '../components/Filters';
import { TestCard } from '../components/TestCard';
import { useExperiments } from '../lib/api';
import { STAGES, fmtPct } from '../lib/format';

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-line bg-card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="display num mt-1 text-4xl leading-none">{value}</div>
      <div className="mt-2 text-xs text-ink-500">{note}</div>
    </div>
  );
}

export function Board() {
  const { data, isLoading, error } = useExperiments();
  const f = useFilteredTests(data);
  const filtered = f.rows;

  const by = (s: Stage) => filtered.filter((x) => x.a.stage === s);
  const called = by('called');
  const wins = called.filter((x) => x.exp.decision === 'winner').length;

  if (error) return <p className="text-berry-600">Could not load tests: {error.message}</p>;

  return (
    <div>
      <section className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="font-script text-2xl text-teal-500">On the rail</p>
          <h1 className="display mt-1 text-5xl leading-[1.05] sm:text-6xl">Tickets</h1>
          <p className="mt-3 max-w-xl text-ink-700">Every A/B test across every client and platform.</p>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat label="Running" value={String(by('running').length)} note="Live, still collecting" />
        <Stat label="Ready" value={String(by('ready').length)} note="Hit the call rules" />
        <Stat label="Called" value={String(called.length)} note="Called and documented" />
        <Stat label="Win rate" value={called.length ? fmtPct(wins / called.length, 0) : '—'} note={`${wins} of ${called.length} called tests`} />
      </section>

      <div className="mt-8">
        <Filters f={f} count={filtered.length} />
      </div>

      <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Tests by stage">
        {STAGES.map((s) => {
          const items = by(s.id).sort((x, y) => y.a.days - x.a.days);
          return (
            <div key={s.id} className="flex flex-col">
              <header className="mb-3 flex items-end justify-between gap-2 border-b border-ink-900 pb-2">
                <div className="flex items-center gap-2">
                  <img src={`/art/${s.art}.svg`} alt="" className="h-8 w-8" />
                  <h2 className="display text-xl leading-none">{s.label}</h2>
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
