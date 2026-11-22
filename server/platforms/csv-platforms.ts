/**
 * Shopify-native testing apps without a public results API.
 * Both import through CSV exports; the demo generates a CSV in each app's
 * column style and runs it through the same importer a real upload uses.
 */
import type { PlatformStatus } from '../../shared/types.js';
import { parseCsv } from './csv.js';
import { simulationsFor, type Simulation } from './demo.js';
import type { PlatformAdapter } from './types.js';

const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function toCsv(sims: Simulation[], header: string[], row: (sim: Simulation, vi: number, d: { date: string; visitors: number; conversions: number; revenue: number } | null) => (string | number)[]): string {
  const lines = [header.join(',')];
  for (const sim of sims) {
    sim.variants.forEach((v, vi) => {
      if (!v.daily.length) lines.push(row(sim, vi, null).map(esc).join(','));
      for (const d of v.daily) lines.push(row(sim, vi, d).map(esc).join(','));
    });
  }
  return lines.join('\n');
}

const SHOPLIFT_STATUS: Record<PlatformStatus, string> = { running: 'Live', paused: 'Paused', draft: 'Draft', stopped: 'Ended' };

export const shoplift: PlatformAdapter = {
  id: 'shoplift',
  name: 'Shoplift',
  connection: 'CSV export from the Shoplift test report (no public results API)',
  docsUrl: 'https://www.shoplift.ai/',
  envVars: [],
  normalize: (raw) => parseCsv(raw as string).experiments,
  demoPayload: (now) =>
    toCsv(
      simulationsFor('shoplift', now),
      ['Test ID', 'Test Name', 'Store', 'Status', 'Hypothesis', 'URL', 'Variant', 'Date', 'Visitors', 'Orders', 'Revenue'],
      (sim, vi, d) => {
        const s = sim.scenario;
        return [s.key, s.name, s.client, SHOPLIFT_STATUS[s.status], s.hypothesis, s.url, sim.variants[vi]!.name, d?.date ?? '', d?.visitors ?? 0, d?.conversions ?? 0, d?.revenue.toFixed(2) ?? '0.00'];
      },
    ),
};

const ROLLOUT_STATUS: Record<PlatformStatus, string> = { running: 'Running', paused: 'Paused', draft: 'Scheduled', stopped: 'Ended' };

export const shopifyRollouts: PlatformAdapter = {
  id: 'shopify-rollouts',
  name: 'Shopify Rollouts',
  connection: 'CSV export from Shopify admin theme A/B tests (no public results API)',
  docsUrl: 'https://help.shopify.com/',
  envVars: [],
  normalize: (raw) => parseCsv(raw as string).experiments,
  demoPayload: (now) =>
    toCsv(
      simulationsFor('shopify-rollouts', now),
      ['Rollout ID', 'Rollout name', 'Shop', 'State', 'Description', 'Theme', 'Day', 'Sessions', 'Orders', 'Total sales'],
      (sim, vi, d) => {
        const s = sim.scenario;
        return [s.key, s.name, s.client, ROLLOUT_STATUS[s.status], s.hypothesis, sim.variants[vi]!.name, d?.date ?? '', d?.visitors ?? 0, d?.conversions ?? 0, d?.revenue.toFixed(2) ?? '0.00'];
      },
    ),
};
