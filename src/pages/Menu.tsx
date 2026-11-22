import { useState } from 'react';
import { Link } from 'wouter';
import { RULES, resultsUnlocked } from '../../shared/stats';
import type { Stage } from '../../shared/types';
import { DecisionBadge, PlatformBadge, StageBadge } from '../components/Badges';
import { Filters, selectClass, useFilteredTests, type Row } from '../components/Filters';
import { useExperiments } from '../lib/api';
import { PLATFORM_NAMES, STAGES, fmtLift, fmtPct } from '../lib/format';
import { usePeeking } from '../lib/peeking';

type SortKey = 'name' | 'client' | 'platform' | 'stage' | 'days' | 'sample' | 'lift' | 'confidence';
const STAGE_ORDER: Record<Stage, number> = { draft: 0, running: 1, ready: 2, called: 3 };

const SORTERS: Record<SortKey, (r: Row) => string | number> = {
  name: (r) => r.exp.name.toLowerCase(),
  client: (r) => r.exp.clientName.toLowerCase(),
  platform: (r) => PLATFORM_NAMES[r.exp.platform],
  stage: (r) => STAGE_ORDER[r.a.stage] * 1000 - r.a.days,
  days: (r) => r.a.days,
  sample: (r) => r.a.sampleProgress,
  lift: (r) => r.a.best?.lift ?? -Infinity,
  confidence: (r) => r.a.best?.confidence ?? -Infinity,
};

function SortHeader({ k, label, sort, setSort, align = 'left', disabled }: { k: SortKey; label: string; sort: { key: SortKey; dir: 1 | -1 }; setSort: (s: { key: SortKey; dir: 1 | -1 }) => void; align?: 'left' | 'right'; disabled?: boolean }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} className={`whitespace-nowrap px-3 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {disabled ? (
        <span className="eyebrow">{label}</span>
      ) : (
        <button
          type="button"
          onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : k === 'name' || k === 'client' || k === 'platform' || k === 'stage' ? 1 : -1 })}
          className={`eyebrow inline-flex items-center gap-1 hover:text-ink-900 ${active ? 'text-ink-900' : ''}`}
        >
          {label}
          <span aria-hidden className={active ? '' : 'opacity-0'}>
            {sort.dir === 1 ? '↑' : '↓'}
          </span>
        </button>
      )}
    </th>
  );
}

/** A results cell: real value when unlocked, a neutral blurred stand-in otherwise (so blur and color leak nothing). */
function ResultCell({ unlocked, onReveal, label, children, placeholder }: { unlocked: boolean; onReveal: () => void; label: string; children: React.ReactNode; placeholder: string }) {
  if (unlocked) return <td className="num whitespace-nowrap px-3 py-3 text-right">{children}</td>;
  return (
    <td className="px-3 py-3 text-right">
      <button type="button" onClick={onReveal} aria-label={label} title="Click to peek" className="num cursor-pointer select-none rounded-sm px-1 text-ink-500 blur-[5px] transition hover:blur-[3px]">
        {placeholder}
      </button>
    </td>
  );
}

export function Menu() {
  const { data, isLoading, error } = useExperiments();
  const f = useFilteredTests(data);
  const { peeking, isPeeked, peek } = usePeeking();
  const [stage, setStage] = useState<'all' | Stage>('all');
  const [revealAll, setRevealAll] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'stage', dir: 1 });

  const isOpen = (r: Row) => revealAll || resultsUnlocked(r.exp, r.a, peeking) || isPeeked(r.exp.id);
  const rows = f.rows.filter((r) => stage === 'all' || r.a.stage === stage);
  const anyHidden = rows.some((r) => r.a.best && !isOpen(r));
  // Sorting by a hidden result would reveal its order, so those sorts wait until results are visible.
  const resultSortLocked = anyHidden;
  const activeSort = resultSortLocked && (sort.key === 'lift' || sort.key === 'confidence') ? { key: 'stage' as SortKey, dir: 1 as const } : sort;
  const sorted = [...rows].sort((x, y) => {
    const a = SORTERS[activeSort.key](x);
    const b = SORTERS[activeSort.key](y);
    return (a < b ? -1 : a > b ? 1 : 0) * activeSort.dir;
  });

  if (error) return <p className="text-berry-600">Could not load tests: {error.message}</p>;

  return (
    <div>
      <p className="font-script text-2xl text-teal-500">Every course, line by line</p>
      <h1 className="display mt-1 text-5xl leading-[1.05] sm:text-6xl">Menu</h1>
      <p className="mt-3 max-w-xl text-ink-700">Every test on one sheet.</p>

      <div className="mt-8">
        <Filters f={f} count={sorted.length}>
          <select aria-label="Stage" className={selectClass} value={stage} onChange={(e) => setStage(e.target.value as Stage | 'all')}>
            <option value="all">All stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {!peeking && (
            <button type="button" onClick={() => setRevealAll((v) => !v)} className="rounded-pill border border-line bg-card px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-teal-300 hover:text-teal-600">
              {revealAll ? 'Blur results again' : 'Show all results'}
            </button>
          )}
        </Filters>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b border-line bg-canvas/60">
            <tr>
              <SortHeader k="name" label="Test" sort={activeSort} setSort={setSort} />
              <SortHeader k="client" label="Client" sort={activeSort} setSort={setSort} />
              <SortHeader k="platform" label="Platform" sort={activeSort} setSort={setSort} />
              <SortHeader k="stage" label="Stage" sort={activeSort} setSort={setSort} />
              <SortHeader k="days" label="Run time" sort={activeSort} setSort={setSort} align="right" />
              <SortHeader k="sample" label="Sample" sort={activeSort} setSort={setSort} align="right" />
              <th scope="col" className="whitespace-nowrap border-l border-line px-3 py-2.5 text-left">
                <span className="eyebrow">Leading</span>
              </th>
              <SortHeader k="lift" label="Lift" sort={activeSort} setSort={setSort} align="right" disabled={resultSortLocked} />
              <SortHeader k="confidence" label="Confidence" sort={activeSort} setSort={setSort} align="right" disabled={resultSortLocked} />
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="eyebrow">{fmtPct(RULES.confidence, 0)} interval</span>
              </th>
              <th scope="col" className="whitespace-nowrap border-l border-line px-3 py-2.5 text-left">
                <span className="eyebrow">Call</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-line">
                  <td colSpan={11} className="px-3 py-3">
                    <div className="h-5 animate-pulse rounded-sm bg-wash" />
                  </td>
                </tr>
              ))}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-ink-500">
                  No tests match these filters.
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const { exp, a } = r;
              const open = isOpen(r);
              const leader = a.best ? exp.variants.find((v) => v.id === a.best!.variantId) : null;
              const live = a.stage === 'running' || a.stage === 'ready';
              const reveal = () => peek(exp.id);
              const hiddenLabel = `Peek at results for ${exp.name}`;
              return (
                <tr key={exp.id} className="border-b border-line transition-colors last:border-0 hover:bg-canvas">
                  <th scope="row" className="min-w-[240px] max-w-[320px] px-3 py-3 text-left font-normal">
                    <Link href={`/tests/${exp.id}`} className="font-medium text-ink-900 underline-offset-4 hover:text-teal-600 hover:underline">
                      {exp.name}
                    </Link>
                    {exp.status === 'paused' && <span className="ml-2 text-[11px] text-berry-600">paused</span>}
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-700">{exp.clientName}</td>
                  <td className="px-3 py-3">
                    <PlatformBadge platform={exp.platform} />
                  </td>
                  <td className="px-3 py-3">
                    <StageBadge stage={a.stage} />
                  </td>
                  <td className="num whitespace-nowrap px-3 py-3 text-right">
                    {a.stage === 'draft' ? (
                      <span className="text-ink-400">{'—'}</span>
                    ) : (
                      <span className={a.minDaysReached ? 'text-ink-900' : 'text-ink-500'}>
                        {a.days}
                        {live && <span className="text-ink-400"> / {RULES.minDays}</span>} d
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {a.stage === 'draft' ? (
                      <span className="text-ink-400">{'—'}</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1 w-14 overflow-hidden rounded-pill bg-wash" aria-hidden>
                          <span className={`block h-full rounded-pill ${a.sampleReached ? 'bg-teal-500' : 'bg-teal-300'}`} style={{ width: `${Math.round(a.sampleProgress * 100)}%` }} />
                        </span>
                        <span className="num w-10 text-right text-ink-700">{fmtPct(a.sampleProgress, 0)}</span>
                      </span>
                    )}
                  </td>

                  {!a.best ? (
                    <>
                      <td className="border-l border-line px-3 py-3 text-ink-400">{'—'}</td>
                      <td className="px-3 py-3 text-right text-ink-400">{'—'}</td>
                      <td className="px-3 py-3 text-right text-ink-400">{'—'}</td>
                      <td className="px-3 py-3 text-right text-ink-400">{'—'}</td>
                    </>
                  ) : (
                    <>
                      {open ? (
                        <td className="max-w-[160px] truncate border-l border-line px-3 py-3 text-ink-700">{leader?.name}</td>
                      ) : (
                        <td className="border-l border-line px-3 py-3">
                          <button type="button" onClick={reveal} aria-label={hiddenLabel} title="Click to peek" className="cursor-pointer select-none text-ink-500 blur-[5px] transition hover:blur-[3px]">
                            Variant name
                          </button>
                        </td>
                      )}
                      <ResultCell unlocked={open} onReveal={reveal} label={hiddenLabel} placeholder="+00.0%">
                        <span className={`font-medium ${a.best.lift >= 0 ? 'text-teal-600' : 'text-berry-600'}`}>{fmtLift(a.best.lift)}</span>
                      </ResultCell>
                      <ResultCell unlocked={open} onReveal={reveal} label={hiddenLabel} placeholder="00.0%">
                        <span className={a.best.significant ? 'font-medium text-teal-600' : 'text-ink-700'}>
                          {fmtPct(a.best.confidence, 1)}
                          {a.best.significant && <span aria-label="significant"> {'✓'}</span>}
                        </span>
                      </ResultCell>
                      <ResultCell unlocked={open} onReveal={reveal} label={hiddenLabel} placeholder="+0% to +00%">
                        <span className="text-ink-500">{a.best.liftInterval ? `${fmtLift(a.best.liftInterval[0], 0)} to ${fmtLift(a.best.liftInterval[1], 0)}` : '—'}</span>
                      </ResultCell>
                    </>
                  )}

                  <td className="border-l border-line px-3 py-3">{exp.decision ? <DecisionBadge decision={exp.decision} /> : <span className="text-ink-400">{'—'}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-500">Leading = the variant with the strongest confidence against control. Sorting by lift or confidence unlocks once results are showing.</p>
    </div>
  );
}
