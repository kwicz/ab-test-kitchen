import { Link } from 'wouter';
import { RULES, resultsUnlocked, type Analysis } from '../../shared/stats';
import type { Experiment } from '../../shared/types';
import { fmtInt, fmtLift, fmtPct } from '../lib/format';
import { usePeeking } from '../lib/peeking';
import { DecisionBadge, PlatformBadge, StatusNote } from './Badges';
import { Meter } from './Meter';

export function TestCard({ exp, analysis: a }: { exp: Experiment; analysis: Analysis }) {
  const { peeking, isPeeked, peek } = usePeeking();
  const unlocked = resultsUnlocked(exp, a, peeking) || isPeeked(exp.id);
  const live = a.stage === 'fermenting' || a.stage === 'ready';
  const winner = exp.decisionVariantId ? exp.variants.find((v) => v.id === exp.decisionVariantId) : null;

  return (
    <article className="group relative rounded-md border border-line bg-card p-4 shadow-soft transition-shadow duration-200 hover:shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{exp.clientName}</span>
        <PlatformBadge platform={exp.platform} />
      </div>
      <h3 className="mt-2 text-[15px] font-medium leading-snug text-ink-900">
        <Link href={`/tests/${exp.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          {exp.name}
        </Link>
      </h3>

      {exp.status === 'paused' && (
        <div className="mt-2">
          <StatusNote status={exp.status} />
        </div>
      )}

      {live && (
        <div className="mt-3 space-y-2">
          <Meter label="Run time" value={`${a.days} / ${RULES.minDays} days`} progress={a.timeProgress} done={a.minDaysReached} />
          <Meter label="Planned sample" value={fmtPct(a.sampleProgress, 0)} progress={a.sampleProgress} done={a.sampleReached} />
        </div>
      )}

      {exp.decision && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DecisionBadge decision={exp.decision} />
          {winner && <span className="text-xs text-ink-500">{winner.name}</span>}
        </div>
      )}

      {live && a.best && (
        <div className="mt-3 border-t border-line pt-3">
          {unlocked ? (
            <div className="flex items-baseline justify-between gap-2">
              <span className={`num text-lg font-medium ${a.best.lift >= 0 ? 'text-teal-600' : 'text-berry-600'}`}>{fmtLift(a.best.lift)}</span>
              <span className="num text-xs text-ink-500">
                {fmtPct(a.best.confidence, 0)} confidence
                {a.best.significant && <span className="ml-1 text-teal-600">{'✓'}</span>}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs text-ink-500">
                <img src="/art/lid.svg" alt="" className="h-4 w-4 opacity-70" />
                Results under the lid
              </span>
              <button
                type="button"
                onClick={() => peek(exp.id)}
                className="relative z-10 rounded-pill border border-line px-2.5 py-1 text-xs text-ink-700 transition-colors hover:border-teal-300 hover:text-teal-600"
              >
                Peek
              </button>
            </div>
          )}
        </div>
      )}

      {a.stage === 'foraging' && <p className="mt-3 text-xs text-ink-500">{exp.variants.length} variants planned</p>}
      {exp.decision && <p className="num mt-2 text-xs text-ink-500">{fmtInt(exp.variants.reduce((s, v) => s + v.visitors, 0))} visitors over {a.days} days</p>}
    </article>
  );
}
