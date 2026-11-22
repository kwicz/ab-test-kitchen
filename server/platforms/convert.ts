/**
 * Convert Experiences, Management API v2.
 * Docs: https://docs.developers.convert.com/reference
 *
 * Endpoint and auth confirmed against Convert's API reference
 * (POST .../experiences/{id}/aggregated_report, Bearer secret key).
 * The report's per-goal field names are UNVERIFIED against a live account.
 */
import type { PlatformStatus } from '../../shared/types.js';
import { simulationsFor } from './demo.js';
import { getJson, num, toIso, type NormalizedExperiment, type PlatformAdapter } from './types.js';

const BASE = 'https://api.convert.com/api/v2';

interface CvVariation { id: number; name: string; is_baseline?: boolean }
interface CvExperience { id: number; project_id: number; name: string; description?: string; status: string; start_time?: number; end_time?: number; url?: string; variations: CvVariation[] }
interface CvGoalRow { id: number; visitors?: number; conversions?: number; revenue?: number }
interface CvReport { data?: { stats_methodology?: string; variations_data?: (CvVariation & { visitors?: number })[]; reportData?: { goal_id: number; goal_name?: string; variations: CvGoalRow[] }[] } }
interface CvDaily { data?: { date: string; variations: CvGoalRow[] }[] }
interface CvBundle { experience: CvExperience; report: CvReport | null; daily: CvDaily | null }
interface CvPayload { projects: { id: number; name: string }[]; experiences: CvBundle[] }

const STATUS: Record<string, PlatformStatus> = { active: 'running', paused: 'paused', completed: 'stopped', archived: 'stopped', stopped: 'stopped', draft: 'draft', scheduled: 'draft' };
const TO_CV: Record<PlatformStatus, string> = { running: 'active', paused: 'paused', draft: 'draft', stopped: 'completed' };

function normalize(raw: unknown): NormalizedExperiment[] {
  const p = raw as CvPayload;
  const projectName = new Map(p.projects.map((x) => [x.id, x.name]));
  return p.experiences.map(({ experience: e, report, daily }) => {
    const goal = report?.data?.reportData?.[0];
    const info = new Map((report?.data?.variations_data ?? []).map((v) => [v.id, v]));
    return {
      externalId: String(e.id),
      clientName: projectName.get(e.project_id) ?? `Convert project ${e.project_id}`,
      name: e.name,
      hypothesis: e.description ?? null,
      url: e.url ?? null,
      primaryMetric: goal?.goal_name ?? 'Conversions',
      status: STATUS[e.status] ?? 'running',
      startedAt: toIso(e.start_time),
      endedAt: toIso(e.end_time),
      variants: e.variations.map((v, i) => {
        const row = goal?.variations.find((r) => r.id === v.id);
        return {
          externalId: String(v.id),
          name: v.name,
          isControl: v.is_baseline ?? i === 0,
          visitors: num(row?.visitors ?? info.get(v.id)?.visitors),
          conversions: num(row?.conversions),
          revenue: row?.revenue ?? null,
          daily: (daily?.data ?? []).map((d) => {
            const r = d.variations.find((x) => x.id === v.id);
            return { date: d.date.slice(0, 10), visitors: num(r?.visitors), conversions: num(r?.conversions) };
          }),
        };
      }),
    };
  });
}

export const convert: PlatformAdapter = {
  id: 'convert',
  name: 'Convert',
  connection: 'Management API v2 with a secret key (Bearer)',
  docsUrl: 'https://docs.developers.convert.com/reference/getexperienceaggregatedreport',
  envVars: ['CONVERT_API_KEY', 'CONVERT_ACCOUNT_ID'],
  normalize,

  async fetchLive(env) {
    const headers = { Authorization: `Bearer ${env.CONVERT_API_KEY}`, 'Content-Type': 'application/json' };
    const acct = `${BASE}/accounts/${env.CONVERT_ACCOUNT_ID}`;
    const post = <T>(url: string, body: unknown = {}) => getJson<T>(url, { method: 'POST', headers, body: JSON.stringify(body) });

    const projectsRes = await post<{ data: { id: number; name: string }[] }>(`${acct}/projects`);
    const wanted = env.CONVERT_PROJECT_IDS?.split(',').map((s) => Number(s.trim()));
    const projects = wanted ? projectsRes.data.filter((p) => wanted.includes(p.id)) : projectsRes.data;

    const experiences: CvBundle[] = [];
    for (const project of projects) {
      const list = await post<{ data: CvExperience[] }>(`${acct}/projects/${project.id}/experiences`, { include: ['variations'] });
      for (const e of list.data.filter((x) => x.status !== 'archived')) {
        const base = `${acct}/projects/${project.id}/experiences/${e.id}`;
        const live = e.status !== 'draft' && e.status !== 'scheduled';
        experiences.push({
          experience: { ...e, project_id: project.id },
          report: live ? await post<CvReport>(`${base}/aggregated_report`) : null,
          daily: live ? await post<CvDaily>(`${base}/daily_report`).catch(() => null) : null,
        });
      }
    }
    return normalize({ projects, experiences } satisfies CvPayload);
  },

  demoPayload(now) {
    const sims = simulationsFor('convert', now);
    const clients = [...new Set(sims.map((s) => s.scenario.client))];
    const projects = clients.map((name, i) => ({ id: 100_300 + i, name }));
    const experiences: CvBundle[] = sims.map((sim) => {
      const s = sim.scenario;
      const id = 1_000_000 + num(s.key.replace(/\D/g, ''));
      const vid = (i: number) => id * 10 + i;
      const unix = (iso: string | null) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined);
      return {
        experience: {
          id,
          project_id: projects.find((p) => p.name === s.client)!.id,
          name: s.name,
          description: s.hypothesis,
          status: TO_CV[s.status],
          start_time: unix(sim.startedAt),
          end_time: unix(sim.endedAt),
          url: s.url,
          variations: sim.variants.map((v, i) => ({ id: vid(i), name: v.name, is_baseline: v.isControl })),
        },
        report: sim.startedAt
          ? {
              data: {
                stats_methodology: 'frequentist',
                variations_data: sim.variants.map((v, i) => ({ id: vid(i), name: v.name, is_baseline: v.isControl, visitors: v.visitors })),
                reportData: [{ goal_id: 501, goal_name: s.metric, variations: sim.variants.map((v, i) => ({ id: vid(i), visitors: v.visitors, conversions: v.conversions, revenue: v.revenue })) }],
              },
            }
          : null,
        daily: sim.startedAt
          ? { data: (sim.variants[0]?.daily ?? []).map((d, di) => ({ date: d.date, variations: sim.variants.map((v, i) => ({ id: vid(i), visitors: v.daily[di]!.visitors, conversions: v.daily[di]!.conversions })) })) }
          : null,
      };
    });
    return { projects, experiences } satisfies CvPayload;
  },
};
