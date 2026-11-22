/**
 * Intelligems (Shopify price, shipping and content tests), External API.
 * Docs: https://docs.intelligems.io/developer-resources/external-api
 *
 * UNVERIFIED against a live account: endpoint paths and field names are
 * written from the public docs and may need small fixes. One API key covers
 * one store, so the client name comes from INTELLIGEMS_CLIENT_NAME.
 */
import type { PlatformStatus } from '../../shared/types.js';
import { simulationsFor } from './demo.js';
import { getJson, num, toIso, type NormalizedExperiment, type PlatformAdapter } from './types.js';

const BASE = 'https://api.intelligems.io/v25-10-beta';

interface IgVariation { id: string; name: string; isControl?: boolean }
interface IgExperience { id: string; name: string; status: string; type?: string; description?: string; startedAtTs?: number; endedAtTs?: number; variations: IgVariation[] }
interface IgMetric { variation_id: string; n_visitors: number; n_orders: number; net_revenue?: number }
interface IgDaily { date: string; variation_id: string; n_visitors: number; n_orders: number }
interface IgBundle { store: string; experience: IgExperience; analytics: { metrics: IgMetric[]; daily?: IgDaily[] } | null }
interface IgPayload { experiences: IgBundle[] }

const STATUS: Record<string, PlatformStatus> = { started: 'running', running: 'running', paused: 'paused', pending: 'draft', draft: 'draft', ended: 'stopped' };
const TO_IG: Record<PlatformStatus, string> = { running: 'started', paused: 'paused', draft: 'pending', stopped: 'ended' };
const TYPE_LABEL: Record<string, string> = { pricing: 'Price test', shipping: 'Shipping test', content: 'Content test' };

function normalize(raw: unknown): NormalizedExperiment[] {
  const p = raw as IgPayload;
  return p.experiences.map(({ store, experience: e, analytics }) => ({
    externalId: e.id,
    clientName: store,
    name: e.name,
    hypothesis: e.description ?? null,
    url: null,
    primaryMetric: e.type ? `Orders (${TYPE_LABEL[e.type] ?? e.type})` : 'Orders',
    status: STATUS[e.status] ?? 'running',
    startedAt: toIso(e.startedAtTs),
    endedAt: toIso(e.endedAtTs),
    variants: e.variations.map((v, i) => {
      const m = analytics?.metrics.find((x) => x.variation_id === v.id);
      return {
        externalId: v.id,
        name: v.name,
        isControl: v.isControl ?? i === 0,
        visitors: num(m?.n_visitors),
        conversions: num(m?.n_orders),
        revenue: m?.net_revenue ?? null,
        daily: (analytics?.daily ?? []).filter((d) => d.variation_id === v.id).map((d) => ({ date: d.date, visitors: d.n_visitors, conversions: d.n_orders })),
      };
    }),
  }));
}

export const intelligems: PlatformAdapter = {
  id: 'intelligems',
  name: 'Intelligems',
  connection: 'External API with a per-store access token',
  docsUrl: 'https://docs.intelligems.io/',
  envVars: ['INTELLIGEMS_API_KEY', 'INTELLIGEMS_CLIENT_NAME'],
  normalize,

  async fetchLive(env) {
    const headers = { 'intelligems-access-token': env.INTELLIGEMS_API_KEY! };
    const list = await getJson<{ experiencesList: IgExperience[] }>(`${BASE}/experiences-list`, { headers });
    const experiences: IgBundle[] = [];
    for (const e of list.experiencesList) {
      const analytics = e.status === 'pending' ? null : await getJson<{ metrics: IgMetric[] }>(`${BASE}/analytics/resource/${e.id}`, { headers });
      experiences.push({ store: env.INTELLIGEMS_CLIENT_NAME!, experience: e, analytics });
    }
    return normalize({ experiences } satisfies IgPayload);
  },

  demoPayload(now) {
    return {
      experiences: simulationsFor('intelligems', now).map((sim) => {
        const s = sim.scenario;
        const vid = (i: number) => `${s.key}-${String.fromCharCode(97 + i)}`;
        return {
          store: s.client,
          experience: {
            id: `ig_${s.key.replace(/^ig-/, "")}`,
            name: s.name,
            status: TO_IG[s.status],
            type: /price/i.test(s.name) ? 'pricing' : /ship/i.test(s.name) ? 'shipping' : 'content',
            description: s.hypothesis,
            startedAtTs: sim.startedAt ? new Date(sim.startedAt).getTime() : undefined,
            endedAtTs: sim.endedAt ? new Date(sim.endedAt).getTime() : undefined,
            variations: sim.variants.map((v, i) => ({ id: vid(i), name: v.name, isControl: v.isControl })),
          },
          analytics: sim.startedAt
            ? {
                metrics: sim.variants.map((v, i) => ({ variation_id: vid(i), n_visitors: v.visitors, n_orders: v.conversions, net_revenue: v.revenue })),
                daily: sim.variants.flatMap((v, i) => v.daily.map((d) => ({ date: d.date, variation_id: vid(i), n_visitors: d.visitors, n_orders: d.conversions }))),
              }
            : null,
        };
      }),
    } satisfies IgPayload;
  },
};
