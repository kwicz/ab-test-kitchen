import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { RULES, analyze, resultsUnlocked, type Analysis } from '../../shared/stats';
import type { Decision, Experiment } from '../../shared/types';
import { DecisionBadge, PlatformBadge, StageBadge, StatusNote } from '../components/Badges';
import { ConversionChart } from '../components/ConversionChart';
import { Meter } from '../components/Meter';
import { useExperiment, useUpdateExperiment } from '../lib/api';
import { SERIES, fmtDate, fmtInt, fmtLift, fmtMoney, fmtPct } from '../lib/format';
import { usePeeking } from '../lib/peeking';

const MDE_OPTIONS = [0.05, 0.1, 0.15, 0.2];

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-2xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Progress({ exp, a }: { exp: Experiment; a: Analysis }) {
  const update = useUpdateExperiment(exp.id);
  return (
    <Section
      title="Timing"
      aside={
        <label className="flex items-center gap-2 text-sm text-ink-500">
          Planned to detect
          <select
            className="rounded-pill border border-line bg-card px-2 py-1 text-sm text-ink-900"
            value={exp.mde}
            onChange={(e) => update.mutate({ mde: Number(e.target.value) })}
          >
            {MDE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {fmtPct(m, 0)} lift
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Meter size="md" label="Run time" value={`${a.days} of ${RULES.minDays} days minimum`} progress={a.timeProgress} done={a.minDaysReached} />
        <Meter
          size="md"
          label="Planned sample (smallest arm)"
          value={Number.isFinite(a.requiredPerVariant) ? `${fmtInt(a.smallestArm)} of ${fmtInt(a.requiredPerVariant)}` : 'needs data'}
          progress={a.sampleProgress}
          done={a.sampleReached}
        />
      </div>
      <p className="mt-4 text-sm text-ink-700">
        {a.stage === 'draft'
          ? 'Not live yet.'
          : exp.endedAt
            ? `Ran ${fmtDate(exp.startedAt)} to ${fmtDate(exp.endedAt)}.`
            : a.sampleReached
              ? 'Planned sample reached.'
              : a.daysToSample !== null
                ? `About ${a.daysToSample} more days to reach the planned sample at current traffic.`
                : 'Waiting for traffic.'}{' '}
        <span className="text-ink-500">
          Sample planned at {fmtPct(RULES.confidence, 0)} confidence and {fmtPct(RULES.power, 0)} power.
        </span>
      </p>
    </Section>
  );
}

function Results({ exp, a, unlocked }: { exp: Experiment; a: Analysis; unlocked: boolean }) {
  const { peeking, isPeeked, peek, unpeek } = usePeeking();
  const control = exp.variants.find((v) => v.isControl);
  const hasRevenue = exp.variants.some((v) => v.revenue !== null && v.visitors > 0);

  if (!unlocked) {
    return (
      <Section title="Results">
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <img src="/art/lid.svg" alt="" className="h-16 w-16" />
          <p className="display mt-4 text-2xl">Still under the lid</p>
          <p className="mt-2 max-w-md text-sm text-ink-700">
            Peeking is off. Checking results before the planned sample raises the odds of calling a false winner.
            {a.daysToSample ? ` Results unlock in about ${Math.max(a.daysToSample, RULES.minDays - a.days)} days.` : ''}
          </p>
          <button
            type="button"
            onClick={() => peek(exp.id)}
            className="mt-5 rounded-pill bg-ink-900 px-4 py-2 text-sm text-white transition-colors hover:bg-teal-600"
          >
            Lift the lid on this test
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Results"
      aside={
        !peeking && isPeeked(exp.id) && !exp.decision ? (
          <button type="button" onClick={() => unpeek(exp.id)} className="text-sm text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">
            Put the lid back
          </button>
        ) : null
      }
    >
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {['Variant', 'Visitors', 'Conversions', 'Conv. rate', 'Lift', `${fmtPct(RULES.confidence, 0)} interval`, 'Confidence', ...(hasRevenue ? ['Rev / visitor'] : [])].map((h, i) => (
                <th key={h} scope="col" className={`eyebrow pb-2 font-medium ${i > 0 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exp.variants.map((v, i) => {
              const c = a.comparisons.find((x) => x.variantId === v.id);
              const rate = v.visitors ? v.conversions / v.visitors : 0;
              return (
                <tr key={v.id} className="border-b border-line last:border-0">
                  <th scope="row" className="py-3 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[i] ?? SERIES[3] }} aria-hidden />
                      <span className="text-ink-900">{v.name}</span>
                      {v.isControl && <span className="text-xs text-ink-400">control</span>}
                      {exp.decisionVariantId === v.id && <DecisionBadge decision="winner" />}
                    </span>
                  </th>
                  <td className="num py-3 text-right text-ink-700">{fmtInt(v.visitors)}</td>
                  <td className="num py-3 text-right text-ink-700">{fmtInt(v.conversions)}</td>
                  <td className="num py-3 text-right text-ink-900">{fmtPct(rate, 2)}</td>
                  <td className={`num py-3 text-right font-medium ${!c ? 'text-ink-400' : c.lift >= 0 ? 'text-teal-600' : 'text-berry-600'}`}>{c ? fmtLift(c.lift) : '—'}</td>
                  <td className="num py-3 text-right text-ink-500">{c?.liftInterval ? `${fmtLift(c.liftInterval[0], 0)} to ${fmtLift(c.liftInterval[1], 0)}` : '—'}</td>
                  <td className="num py-3 text-right">
                    {c ? (
                      <span className={c.significant ? 'font-medium text-teal-600' : 'text-ink-700'}>
                        {fmtPct(c.confidence, 1)}
                        {c.significant && <span className="sr-only"> (significant)</span>}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {hasRevenue && <td className="num py-3 text-right text-ink-700">{v.visitors && v.revenue !== null ? fmtMoney(v.revenue / v.visitors) : '—'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {control && (
        <p className="mt-3 text-xs text-ink-500">
          Recomputed from raw counts with a two-sided two-proportion z-test against {control.name}. Significant at {fmtPct(RULES.confidence, 0)} or higher.
        </p>
      )}
      <div className="mt-6 border-t border-line pt-5">
        <ConversionChart variants={exp.variants} />
      </div>
    </Section>
  );
}

function CallIt({ exp, a }: { exp: Experiment; a: Analysis }) {
  const update = useUpdateExperiment(exp.id);
  const [notes, setNotes] = useState(exp.notes ?? '');
  useEffect(() => setNotes(exp.notes ?? ''), [exp.notes]);
  const challengers = exp.variants.filter((v) => !v.isControl);

  const call = (decision: Decision, decisionVariantId: number | null = null) => update.mutate({ decision, decisionVariantId, notes: notes || null });

  const btn = 'rounded-pill border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50';

  return (
    <Section title={exp.decision ? 'Called' : 'Call it'}>
      {exp.decision ? (
        <div className="flex flex-wrap items-center gap-3">
          <DecisionBadge decision={exp.decision} />
          {exp.decisionVariantId && <span className="text-sm text-ink-700">{exp.variants.find((v) => v.id === exp.decisionVariantId)?.name}</span>}
          <span className="text-sm text-ink-500">called {fmtDate(exp.decidedAt)}</span>
          <button type="button" onClick={() => update.mutate({ decision: null })} className="ml-auto text-sm text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">
            Reopen
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-700">
            {a.stage === 'ready' ? 'This test is ready to call.' : 'Not at the call rules yet. You can still call it early.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {challengers.map((v) => (
              <button key={v.id} type="button" disabled={update.isPending} onClick={() => call('winner', v.id)} className={`${btn} border-teal-500 bg-teal-500 text-white hover:bg-teal-600`}>
                Winner: {v.name}
              </button>
            ))}
            <button type="button" disabled={update.isPending} onClick={() => call('learner')} className={`${btn} border-line text-berry-600 hover:border-berry-500`}>
              Learner
            </button>
            <button type="button" disabled={update.isPending} onClick={() => call('inconclusive')} className={`${btn} border-line text-ink-700 hover:border-line-strong`}>
              Inconclusive
            </button>
          </div>
        </>
      )}
      <label className="mt-5 block">
        <span className="font-script text-xl text-teal-500">Chef's notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (exp.notes ?? '') && update.mutate({ notes: notes || null })}
          rows={3}
          placeholder="What did we learn? What's next?"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-teal-300 focus:outline-none"
        />
      </label>
      {update.error && <p className="mt-2 text-sm text-berry-600">{update.error.message}</p>}
    </Section>
  );
}

export function TestDetail({ id }: { id: number }) {
  const { data: exp, isLoading, error } = useExperiment(id);
  const { peeking, isPeeked } = usePeeking();
  const [, navigate] = useLocation();

  if (isLoading) return <div className="h-96 animate-pulse rounded-lg bg-wash" />;
  if (error || !exp) {
    return (
      <div className="py-24 text-center">
        <img src="/art/called.svg" alt="" className="mx-auto h-14 w-14" />
        <p className="display mt-4 text-3xl">{error && 'status' in error && error.status === 404 ? 'This test is not on the menu.' : 'Could not load this test.'}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-teal-600 underline underline-offset-4">
          Back to the Menu
        </Link>
      </div>
    );
  }

  const a = analyze(exp);
  const unlocked = resultsUnlocked(exp, a, peeking) || isPeeked(exp.id);

  return (
    <div className="mx-auto max-w-5xl">
      <button type="button" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))} className="text-sm text-ink-500 hover:text-ink-900">
        {'←'} Back
      </button>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{exp.clientName}</span>
          <PlatformBadge platform={exp.platform} />
          <StageBadge stage={a.stage} />
          <StatusNote status={exp.status} />
        </div>
        <h1 className="display mt-3 text-4xl leading-tight sm:text-5xl">{exp.name}</h1>
        {exp.hypothesis && <p className="mt-3 max-w-3xl text-lg text-ink-700">{exp.hypothesis}</p>}
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {[
            ['Primary metric', exp.primaryMetric],
            ['Started', fmtDate(exp.startedAt)],
            ['Pages', exp.url ?? '—'],
            ['Platform ID', exp.externalId],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-500">{k}</dt>
              <dd className="num text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-8 grid gap-5">
        {a.stage !== 'draft' && <Progress exp={exp} a={a} />}
        {a.stage !== 'draft' && <Results exp={exp} a={a} unlocked={unlocked} />}
        {a.stage === 'draft' && (
          <Section title="Not live yet">
            <p className="text-sm text-ink-700">This test is drafted on {exp.platform === 'shopify-rollouts' ? 'Shopify' : 'the platform'} but not live yet.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {exp.variants.map((v, i) => (
                <li key={v.id} className="flex items-center gap-2 rounded-pill border border-line px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES[i] ?? SERIES[3] }} aria-hidden />
                  {v.name}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {a.stage !== 'draft' && <CallIt exp={exp} a={a} />}
      </div>
    </div>
  );
}
