import type { DailyPoint, PlatformId, PlatformStatus } from '../../shared/types.js';

/** One experiment in the shape every connector hands to the database. */
export interface NormalizedExperiment {
  externalId: string;
  clientName: string;
  name: string;
  hypothesis: string | null;
  url: string | null;
  primaryMetric: string;
  status: PlatformStatus;
  startedAt: string | null;
  endedAt: string | null;
  variants: NormalizedVariant[];
}

export interface NormalizedVariant {
  externalId: string;
  name: string;
  isControl: boolean;
  visitors: number;
  conversions: number;
  revenue: number | null;
  daily: DailyPoint[];
}

export interface PlatformAdapter {
  id: PlatformId;
  name: string;
  /** How the connector talks to the platform, in plain words. */
  connection: string;
  docsUrl: string;
  /** Env vars the live client needs. Empty when the platform has no public results API. */
  envVars: string[];
  /** Pull live data. Only called when every env var is set. */
  fetchLive?: (env: NodeJS.ProcessEnv) => Promise<NormalizedExperiment[]>;
  /** Sample data in the platform's own response/export shape. */
  demoPayload: (now: Date) => unknown;
  /** Turn the platform's own shape into normalized experiments. */
  normalize: (raw: unknown) => NormalizedExperiment[];
}

export function hasLiveCredentials(adapter: PlatformAdapter, env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(adapter.fetchLive) && adapter.envVars.length > 0 && adapter.envVars.every((k) => Boolean(env[k]));
}

/** Small fetch helper that throws with the response body on non-2xx. */
export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${init.method ?? 'GET'} ${url} -> ${res.status} ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const toIso = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
