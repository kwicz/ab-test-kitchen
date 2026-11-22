/**
 * VWO Testing, REST API v2.
 * Docs: https://developers.vwo.com/reference
 *
 * UNVERIFIED against a live account. The campaign list endpoint is public;
 * the report endpoint path is a best guess. If VWO does not expose per-
 * variation totals for your plan, use CSV export from the VWO report instead.
 */
import type { PlatformStatus } from '../../shared/types.js';
import { simulationsFor } from './demo.js';
import { getJson, num, toIso, type NormalizedExperiment, type PlatformAdapter } from './types.js';

const BASE = 'https://app.vwo.com/api/v2';

interface VwoVariation { id: number; name: string; isControl?: boolean }
interface VwoCampaign { id: number; name: string; status: string; type?: string; primaryUrl?: string; startedOn?: number; endedOn?: number; description?: string; variations: VwoVariation[]; goals?: { id: number; name: string }[] }
interface VwoReportRow { variationId: number; visitors: number; conversions: number; revenue?: number }
interface VwoDaily { date: string; rows: VwoReportRow[] }
interface VwoBundle { campaign: VwoCampaign; report: { rows: VwoReportRow[]; daily?: VwoDaily[] } | null }
interface VwoPayload { accounts: { id: number; name: string; campaigns: VwoBundle[] }[] }

const STATUS: Record<string, PlatformStatus> = { RUNNING: 'running', PAUSED: 'paused', NOT_STARTED: 'draft', STOPPED: 'stopped', ARCHIVED: 'stopped' };
const TO_VWO: Record<PlatformStatus, string> = { running: 'RUNNING', paused: 'PAUSED', draft: 'NOT_STARTED', stopped: 'STOPPED' };

function normalize(raw: unknown): NormalizedExperiment[] {
  const p = raw as VwoPayload;
  return p.accounts.flatMap((acct) =>
    acct.campaigns.map(({ campaign: c, report }) => ({
      externalId: String(c.id),
      clientName: acct.name,
      name: c.name,
      hypothesis: c.description ?? null,
      url: c.primaryUrl ?? null,
      primaryMetric: c.goals?.[0]?.name ?? 'Conversions',
      status: STATUS[c.status] ?? 'running',
      startedAt: toIso(c.startedOn),
      endedAt: toIso(c.endedOn),
      variants: c.variations.map((v, i) => {
        const row = report?.rows.find((r) => r.variationId === v.id);
        return {
          externalId: String(v.id),
          name: v.name,
          isControl: v.isControl ?? i === 0,
          visitors: num(row?.visitors),
          conversions: num(row?.conversions),
          revenue: row?.revenue ?? null,
          daily: (report?.daily ?? []).map((d) => {
            const r = d.rows.find((x) => x.variationId === v.id);
            return { date: d.date, visitors: num(r?.visitors), conversions: num(r?.conversions) };
          }),
        };
      }),
    })),
  );
}

export const vwo: PlatformAdapter = {
  id: 'vwo',
  name: 'VWO',
  connection: 'REST API v2 with an API token per account',
  docsUrl: 'https://developers.vwo.com/reference/introduction',
  envVars: ['VWO_API_TOKEN', 'VWO_ACCOUNT_IDS'],
  normalize,

  async fetchLive(env) {
    const headers = { token: env.VWO_API_TOKEN! };
    const accounts: VwoPayload['accounts'] = [];
    for (const id of env.VWO_ACCOUNT_IDS!.split(',').map((s) => s.trim())) {
      const acct = await getJson<{ _data: { id: number; name: string } }>(`${BASE}/accounts/${id}`, { headers });
      const list = await getJson<{ _data: VwoCampaign[] }>(`${BASE}/accounts/${id}/campaigns?type=ab`, { headers });
      const campaigns: VwoBundle[] = [];
      for (const c of list._data) {
        const report = c.status === 'NOT_STARTED' ? null : await getJson<{ _data: { rows: VwoReportRow[] } }>(`${BASE}/accounts/${id}/campaigns/${c.id}/report`, { headers }).then((r) => r._data).catch(() => null);
        campaigns.push({ campaign: c, report });
      }
      accounts.push({ id: acct._data.id, name: acct._data.name, campaigns });
    }
    return normalize({ accounts } satisfies VwoPayload);
  },

  demoPayload(now) {
    const sims = simulationsFor('vwo', now);
    const clients = [...new Set(sims.map((s) => s.scenario.client))];
    return {
      accounts: clients.map((name, ai) => ({
        id: 700_000 + ai,
        name,
        campaigns: sims
          .filter((s) => s.scenario.client === name)
          .map((sim) => {
            const s = sim.scenario;
            const unix = (iso: string | null) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined);
            return {
              campaign: {
                id: num(s.key.replace(/\D/g, '')),
                name: s.name,
                status: TO_VWO[s.status],
                type: 'ab',
                primaryUrl: s.url,
                description: s.hypothesis,
                startedOn: unix(sim.startedAt),
                endedOn: unix(sim.endedAt),
                variations: sim.variants.map((v, i) => ({ id: i + 1, name: v.name, isControl: v.isControl })),
                goals: [{ id: 1, name: s.metric }],
              },
              report: sim.startedAt
                ? {
                    rows: sim.variants.map((v, i) => ({ variationId: i + 1, visitors: v.visitors, conversions: v.conversions, revenue: v.revenue })),
                    daily: (sim.variants[0]?.daily ?? []).map((d, di) => ({ date: d.date, rows: sim.variants.map((v, i) => ({ variationId: i + 1, visitors: v.daily[di]!.visitors, conversions: v.daily[di]!.conversions })) })),
                  }
                : null,
            };
          }),
      })),
    } satisfies VwoPayload;
  },
};
