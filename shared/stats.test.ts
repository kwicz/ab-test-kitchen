import { describe, expect, it } from 'vitest';
import { analyze, compare, normalCdf, normalInv, requiredSamplePerVariant } from './stats.js';
import type { Experiment } from './types.js';

describe('normal distribution', () => {
  it('matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.6448536)).toBeCloseTo(0.95, 5);
    expect(normalInv(0.95)).toBeCloseTo(1.6448536, 5);
    expect(normalInv(0.8)).toBeCloseTo(0.8416212, 5);
  });
});

describe('compare', () => {
  it('computes lift and confidence for a clear winner', () => {
    const c = compare({ visitors: 10000, conversions: 300 }, { id: 2, visitors: 10000, conversions: 360 });
    expect(c.lift).toBeCloseTo(0.2, 6);
    // z ~= 2.37 -> two-sided confidence ~= 98.2%
    expect(c.confidence).toBeGreaterThan(0.98);
    expect(c.confidence).toBeLessThan(0.985);
    expect(c.significant).toBe(true);
    expect(c.liftInterval![0]).toBeGreaterThan(0);
  });

  it('is not significant for a tiny difference', () => {
    const c = compare({ visitors: 2000, conversions: 60 }, { id: 2, visitors: 2000, conversions: 62 });
    expect(c.significant).toBe(false);
  });
});

describe('requiredSamplePerVariant', () => {
  it('is in the expected range for 3% baseline, 10% MDE, 90% conf, 80% power', () => {
    const n = requiredSamplePerVariant(0.03, 0.1);
    expect(n).toBeGreaterThan(38000);
    expect(n).toBeLessThan(42000);
  });
});

function makeExp(over: Partial<Experiment>, conv: [number, number], visitors = 50000): Experiment {
  return {
    id: 1, clientId: 1, clientName: 'Test', platform: 'convert', externalId: 'x', name: 'x',
    hypothesis: null, url: null, primaryMetric: 'Orders', status: 'running',
    startedAt: '2026-01-01T00:00:00Z', endedAt: null, mde: 0.1, decision: null,
    decisionVariantId: null, decidedAt: null, notes: null, updatedAt: '2026-01-01T00:00:00Z',
    variants: [
      { id: 1, externalId: 'a', name: 'Control', isControl: true, visitors, conversions: conv[0], revenue: null, daily: [] },
      { id: 2, externalId: 'b', name: 'B', isControl: false, visitors, conversions: conv[1], revenue: null, daily: [] },
    ],
    ...over,
  };
}

describe('analyze', () => {
  const day20 = new Date('2026-01-21T00:00:00Z');
  const day5 = new Date('2026-01-06T00:00:00Z');

  it('stays running before 14 days even when significant', () => {
    const a = analyze(makeExp({}, [1500, 1800], 20000), { peeking: true, now: day5 });
    expect(a.best?.significant).toBe(true);
    expect(a.stage).toBe('running');
  });

  it('is ready after 14 days at 90% when peeking', () => {
    const a = analyze(makeExp({}, [600, 720], 20000), { peeking: true, now: day20 });
    expect(a.sampleReached).toBe(false);
    expect(a.stage).toBe('ready');
  });

  it('ignores significance when peeking is off', () => {
    const a = analyze(makeExp({}, [600, 720], 20000), { peeking: false, now: day20 });
    expect(a.stage).toBe('running');
  });

  it('is ready when the planned sample is reached, flat or not', () => {
    const a = analyze(makeExp({}, [1500, 1510], 60000), { peeking: false, now: day20 });
    expect(a.sampleReached).toBe(true);
    expect(a.stage).toBe('ready');
  });

  it('is called once a decision exists and draft when draft', () => {
    expect(analyze(makeExp({ decision: 'winner' }, [1, 1]), { peeking: true }).stage).toBe('called');
    expect(analyze(makeExp({ status: 'draft', startedAt: null }, [0, 0], 0), { peeking: true }).stage).toBe('draft');
  });
});
