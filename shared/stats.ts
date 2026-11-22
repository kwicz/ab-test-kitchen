/**
 * Statistics for A/B Test Kitchen.
 *
 * Every platform reports significance differently (frequentist, Bayesian,
 * sequential). To judge every test by the same rule, the app recomputes
 * results from raw visitors and conversions with a two-sided two-proportion
 * z-test, and plans sample sizes for a fixed horizon.
 */
import type { Experiment, Stage, Variant } from './types.js';

/** The agency's call rules. */
export const RULES = {
  minDays: 14,
  /** Confidence needed to call a test (1 - alpha). */
  confidence: 0.9,
  /** Power used for the planned sample size. */
  power: 0.8,
} as const;

const DAY_MS = 86_400_000;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, max error ~1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** Inverse standard normal CDF (Acklam's algorithm, relative error ~1e-9). */
export function normalInv(p: number): number {
  if (p <= 0 || p >= 1) throw new RangeError('p must be in (0, 1)');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  const hi = 1 - lo;
  let q: number;
  let r: number;
  if (p < lo) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > hi) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export interface Comparison {
  variantId: number;
  /** Conversion rate of the variant. */
  rate: number;
  /** Conversion rate of the control. */
  controlRate: number;
  /** Relative lift over control (0.05 = +5%). */
  lift: number;
  /** Two-sided confidence that the difference is real (1 - p-value). */
  confidence: number;
  /** Relative-lift interval at RULES.confidence, or null when control has no conversions. */
  liftInterval: [number, number] | null;
  significant: boolean;
}

/** Two-proportion z-test of a variant against the control. */
export function compare(control: Pick<Variant, 'visitors' | 'conversions'>, variant: Pick<Variant, 'id' | 'visitors' | 'conversions'>): Comparison {
  const n1 = control.visitors;
  const n2 = variant.visitors;
  const p1 = n1 > 0 ? control.conversions / n1 : 0;
  const p2 = n2 > 0 ? variant.conversions / n2 : 0;
  const lift = p1 > 0 ? (p2 - p1) / p1 : 0;

  let confidence = 0;
  if (n1 > 0 && n2 > 0) {
    const pooled = (control.conversions + variant.conversions) / (n1 + n2);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
    if (se > 0) {
      const z = Math.abs(p2 - p1) / se;
      confidence = 1 - 2 * (1 - normalCdf(z));
    }
  }

  let liftInterval: [number, number] | null = null;
  if (p1 > 0 && n1 > 0 && n2 > 0) {
    const zc = normalInv(1 - (1 - RULES.confidence) / 2);
    const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
    liftInterval = [(p2 - p1 - zc * seDiff) / p1, (p2 - p1 + zc * seDiff) / p1];
  }

  return {
    variantId: variant.id,
    rate: p2,
    controlRate: p1,
    lift,
    confidence,
    liftInterval,
    significant: confidence >= RULES.confidence,
  };
}

/**
 * Visitors needed per variant to detect a relative lift of `mde` from a
 * baseline rate, at RULES.confidence (two-sided) and RULES.power.
 */
export function requiredSamplePerVariant(baselineRate: number, mde: number): number {
  if (baselineRate <= 0 || baselineRate >= 1 || mde <= 0) return Infinity;
  const p1 = baselineRate;
  const p2 = Math.min(p1 * (1 + mde), 0.9999);
  const zAlpha = normalInv(1 - (1 - RULES.confidence) / 2);
  const zBeta = normalInv(RULES.power);
  const n = ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1) ** 2;
  return Math.ceil(n);
}

export function daysRunning(exp: Pick<Experiment, 'startedAt' | 'endedAt'>, now: Date = new Date()): number {
  if (!exp.startedAt) return 0;
  const end = exp.endedAt ? new Date(exp.endedAt) : now;
  return Math.max(0, Math.floor((end.getTime() - new Date(exp.startedAt).getTime()) / DAY_MS));
}

export interface Analysis {
  stage: Stage;
  days: number;
  /** Planned visitors per variant (fixed horizon). */
  requiredPerVariant: number;
  /** Visitors in the smallest arm. */
  smallestArm: number;
  /** 0..1 progress toward the planned sample. */
  sampleProgress: number;
  /** 0..1 progress toward the minimum run time. */
  timeProgress: number;
  sampleReached: boolean;
  minDaysReached: boolean;
  /** Comparisons for every non-control variant. */
  comparisons: Comparison[];
  /** The strongest comparison, by confidence. */
  best: Comparison | null;
  /** Rough days left until the planned sample, from the average daily traffic so far. */
  daysToSample: number | null;
}

/**
 * Work out what stage a test is at.
 *
 * - Peeking ON: ready once it has run 14 days AND either one variant is at
 *   90% confidence or the planned sample is reached (call it flat).
 * - Peeking OFF: the significance check is skipped, so the board cannot leak
 *   results. A test is ready once it has run 14 days AND reached its planned
 *   sample. That is the classic fixed-horizon rule, so results unlock then.
 */
export function analyze(exp: Experiment, opts: { peeking: boolean; now?: Date }): Analysis {
  const now = opts.now ?? new Date();
  const control = exp.variants.find((v) => v.isControl) ?? exp.variants[0];
  const others = exp.variants.filter((v) => v !== control);
  const comparisons = control ? others.map((v) => compare(control, v)) : [];
  const best = comparisons.reduce<Comparison | null>((acc, c) => (!acc || c.confidence > acc.confidence ? c : acc), null);

  const days = daysRunning(exp, now);
  const baseline = control && control.visitors > 0 ? control.conversions / control.visitors : 0;
  const requiredPerVariant = requiredSamplePerVariant(baseline, exp.mde);
  const smallestArm = exp.variants.length ? Math.min(...exp.variants.map((v) => v.visitors)) : 0;
  const sampleProgress = Number.isFinite(requiredPerVariant) ? Math.min(1, smallestArm / requiredPerVariant) : 0;
  const sampleReached = sampleProgress >= 1;
  const minDaysReached = days >= RULES.minDays;
  const timeProgress = Math.min(1, days / RULES.minDays);

  const totalVisitors = exp.variants.reduce((s, v) => s + v.visitors, 0);
  const perArmPerDay = days > 0 && exp.variants.length ? totalVisitors / exp.variants.length / days : 0;
  const daysToSample = sampleReached
    ? 0
    : perArmPerDay > 0 && Number.isFinite(requiredPerVariant)
      ? Math.ceil((requiredPerVariant - smallestArm) / perArmPerDay)
      : null;

  let stage: Stage;
  if (exp.decision) stage = 'served';
  else if (exp.status === 'draft' || !exp.startedAt) stage = 'foraging';
  else {
    const signal = opts.peeking ? Boolean(best?.significant) || sampleReached : sampleReached;
    stage = minDaysReached && signal ? 'ready' : 'fermenting';
  }

  return {
    stage,
    days,
    requiredPerVariant,
    smallestArm,
    sampleProgress,
    timeProgress,
    sampleReached,
    minDaysReached,
    comparisons,
    best,
    daysToSample,
  };
}

/** Whether results may be shown for a test without the viewer opting in. */
export function resultsUnlocked(exp: Experiment, a: Analysis, peeking: boolean): boolean {
  return peeking || exp.decision !== null || (a.minDaysReached && a.sampleReached);
}
