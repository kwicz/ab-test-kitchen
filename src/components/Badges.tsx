import type { Decision, PlatformId, PlatformStatus, Stage } from '../../shared/types';
import { DECISION_LABEL, PLATFORM_NAMES, stageMeta } from '../lib/format';

export function PlatformBadge({ platform }: { platform: PlatformId }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-line px-2 py-0.5 text-[11px] font-medium text-ink-700">
      {PLATFORM_NAMES[platform]}
    </span>
  );
}

const STAGE_STYLE: Record<Stage, string> = {
  draft: 'bg-wash text-ink-700',
  running: 'bg-teal-50 text-teal-600',
  ready: 'bg-honey-50 text-honey-600',
  called: 'bg-sage-50 text-sage-600',
};

export function StageBadge({ stage }: { stage: Stage }) {
  const m = stageMeta(stage);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-medium ${STAGE_STYLE[stage]}`}>
      <img src={`/art/${m.art}.svg`} alt="" className="h-3.5 w-3.5" />
      {m.label}
    </span>
  );
}

const DECISION_STYLE: Record<Decision, string> = {
  winner: 'bg-teal-500 text-white',
  loser: 'bg-berry-50 text-berry-600',
  inconclusive: 'bg-wash text-ink-700',
};

const DECISION_ICON: Record<Decision, string> = { winner: '↑', loser: '↓', inconclusive: '↔' };

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium ${DECISION_STYLE[decision]}`}>
      <span aria-hidden>{DECISION_ICON[decision]}</span>
      {DECISION_LABEL[decision]}
    </span>
  );
}

export function StatusNote({ status }: { status: PlatformStatus }) {
  if (status !== 'paused') return null;
  return <span className="rounded-pill bg-berry-50 px-2 py-0.5 text-[11px] font-medium text-berry-600">Paused on platform</span>;
}
