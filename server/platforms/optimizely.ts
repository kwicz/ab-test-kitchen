/**
 * Optimizely Web Experimentation, REST API v2.
 * Docs: https://docs.developers.optimizely.com/web-experimentation/reference
 *
 * UNVERIFIED against a live account: written from the public API reference.
 * Expect small field fixes on first real connection.
 */
import type { PlatformStatus } from '../../shared/types.js';
import { simulationsFor } from './demo.js';
import { getJson, num, toIso, type NormalizedExperiment, type PlatformAdapter } from './types.js';

const BASE = 'https://api.optimizely.com/v2';

interface OptVariation { variation_id: number; name: string }
interface OptExperiment { id: number; project_id: number; name: string; description?: string; status: string; variations: OptVariation[]; url?: string }
interface OptMetricResult { is_baseline?: boolean; samples: number; value: number; revenue?: number }
interface OptResults { start_time?: string; end_time?: string; metrics?: { name: string; results: Record<string, OptMetricResult> }[] }
interface OptTimeseriesPoint { time: string; samples: number; value: number }
interface OptBundle { experiment: OptExperiment; results: OptResults | null; timeseries?: Record<string, OptTimeseriesPoint[]> }
interface OptPayload { projects: { id: number; name: string }[]; experiments: OptBundle[] }

const STATUS: Record<string, PlatformStatus> = { running: 'running', paused: 'paused', not_started: 'draft', concluded: 'stopped', archived: 'stopped' };
const TO_OPT: Record<PlatformStatus, string> = { running: 'running', paused: 'paused', draft: 'not_started', stopped: 'concluded' };

function normalize(raw: unknown): NormalizedExperiment[] {
  const p = raw as OptPayload;
  const projectName = new Map(p.projects.map((x) => [x.id, x.name]));
  return p.experiments.map(({ experiment: e, results, timeseries }) => {
    const metric = results?.metrics?.[0];
    return {
      externalId: String(e.id),
      clientName: projectName.get(e.project_id) ?? `Optimizely project ${e.project_id}`,
      name: e.name,
      hypothesis: e.description ?? null,
      url: e.url ?? null,
      primaryMetric: metric?.name ?? 'Conversions',
      status: STATUS[e.status] ?? 'running',
      startedAt: toIso(results?.start_time),
      endedAt: toIso(results?.end_time),
      variants: e.variations.map((v, i) => {
        const r = metric?.results[String(v.variation_id)];
        return {
          externalId: String(v.variation_id),
          name: v.name,
          isControl: r?.is_baseline ?? i === 0,
          visitors: num(r?.samples),
          conversions: num(r?.value),
          revenue: r?.revenue ?? null,
          daily: (timeseries?.[String(v.variation_id)] ?? []).map((t) => ({ date: t.time.slice(0, 10), visitors: t.samples, conversions: t.value })),
        };
      }),
    };
  });
}

export const optimizely: PlatformAdapter = {
  id: 'optimizely',
  name: 'Optimizely',
  connection: 'REST API v2 with a personal access token',
  docsUrl: 'https://docs.developers.optimizely.com/web-experimentation/reference/overview',
  envVars: ['OPTIMIZELY_API_TOKEN'],
  normalize,

  async fetchLive(env) {
    const headers = { Authorization: `Bearer ${env.OPTIMIZELY_API_TOKEN}` };
    const allProjects = await getJson<{ id: number; name: string }[]>(`${BASE}/projects?per_page=100`, { headers });
    const wanted = env.OPTIMIZELY_PROJECT_IDS?.split(',').map((s) => Number(s.trim()));
    const projects = wanted ? allProjects.filter((p) => wanted.includes(p.id)) : allProjects;
    const experiments: OptBundle[] = [];
    for (const project of projects) {
      const list = await getJson<OptExperiment[]>(`${BASE}/experiments?project_id=${project.id}&per_page=100`, { headers });
      for (const e of list.filter((x) => x.status !== 'archived')) {
        const results = e.status === 'not_started' ? null : await getJson<OptResults>(`${BASE}/experiments/${e.id}/results`, { headers });
        experiments.push({ experiment: e, results });
      }
    }
    return normalize({ projects, experiments } satisfies OptPayload);
  },

  demoPayload(now) {
    const sims = simulationsFor('optimizely', now);
    const clients = [...new Set(sims.map((s) => s.scenario.client))];
    const projects = clients.map((name, i) => ({ id: 20_000 + i, name }));
    const experiments: OptBundle[] = sims.map((sim) => {
      const s = sim.scenario;
      const vid = (i: number) => num(s.key.replace(/\D/g, '')) * 10 + i;
      return {
        experiment: {
          id: num(s.key.replace(/\D/g, '')),
          project_id: projects.find((p) => p.name === s.client)!.id,
          name: s.name,
          description: s.hypothesis,
          status: TO_OPT[s.status],
          url: s.url,
          variations: sim.variants.map((v, i) => ({ variation_id: vid(i), name: v.name })),
        },
        results: sim.startedAt
          ? {
              start_time: sim.startedAt,
              end_time: sim.endedAt ?? undefined,
              metrics: [{ name: s.metric, results: Object.fromEntries(sim.variants.map((v, i) => [String(vid(i)), { is_baseline: v.isControl, samples: v.visitors, value: v.conversions, revenue: v.revenue }])) }],
            }
          : null,
        timeseries: Object.fromEntries(sim.variants.map((v, i) => [String(vid(i)), v.daily.map((d) => ({ time: `${d.date}T00:00:00Z`, samples: d.visitors, value: d.conversions }))])),
      };
    });
    return { projects, experiments } satisfies OptPayload;
  },
};
