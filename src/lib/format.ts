import type { Decision, PlatformId, Stage } from '../../shared/types';

export const PLATFORM_NAMES: Record<PlatformId, string> = {
  optimizely: 'Optimizely',
  convert: 'Convert',
  vwo: 'VWO',
  intelligems: 'Intelligems',
  shoplift: 'Shoplift',
  'shopify-rollouts': 'Shopify Rollouts',
};

export const STAGES: { id: Stage; label: string; blurb: string; art: string }[] = [
  { id: 'draft', label: 'Draft', blurb: 'Drafted, not yet live', art: 'draft' },
  { id: 'running', label: 'Running', blurb: 'Live and collecting data', art: 'running' },
  { id: 'ready', label: 'Ready', blurb: 'Met the call rules', art: 'ready' },
  { id: 'called', label: 'Called', blurb: 'Called and documented', art: 'called' },
];

export const stageMeta = (s: Stage) => STAGES.find((x) => x.id === s)!;

export const DECISION_LABEL: Record<Decision, string> = {
  winner: 'Winner',
  learner: 'Learner',
  inconclusive: 'Inconclusive',
};

const nf = new Intl.NumberFormat('en-US');
export const fmtInt = (n: number) => nf.format(Math.round(n));

export const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

export const fmtLift = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(digits)}%`;

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';

export const fmtRelative = (iso: string | null) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
};

export const SERIES = ['var(--color-series-control)', 'var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)'];
