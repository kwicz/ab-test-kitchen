export const PLATFORM_IDS = [
  'optimizely',
  'convert',
  'vwo',
  'intelligems',
  'shoplift',
  'shopify-rollouts',
] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

/** Lifecycle status as reported by the testing platform. */
export type PlatformStatus = 'draft' | 'running' | 'paused' | 'stopped';

/** The call the team made once a test was called. */
export type Decision = 'winner' | 'loser' | 'inconclusive';

/** Kitchen stage, derived from platform status, timing, stats and decision. */
export type Stage = 'draft' | 'running' | 'ready' | 'called';

export interface DailyPoint {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  visitors: number;
  conversions: number;
}

export interface Variant {
  id: number;
  externalId: string;
  name: string;
  isControl: boolean;
  visitors: number;
  conversions: number;
  revenue: number | null;
  daily: DailyPoint[];
}

export interface Experiment {
  id: number;
  clientId: number;
  clientName: string;
  platform: PlatformId;
  externalId: string;
  name: string;
  hypothesis: string | null;
  url: string | null;
  primaryMetric: string;
  status: PlatformStatus;
  startedAt: string | null;
  endedAt: string | null;
  /** Minimum detectable effect, relative (0.1 = 10%). Drives the planned sample size. */
  mde: number;
  decision: Decision | null;
  decisionVariantId: number | null;
  decidedAt: string | null;
  notes: string | null;
  updatedAt: string;
  variants: Variant[];
}

export interface Client {
  id: number;
  name: string;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  /** Short description of how the connector talks to the platform. */
  connection: string;
  docsUrl: string;
  /** Whether a live API client exists for this platform. */
  hasApi: boolean;
  /** Environment variables the live client needs. */
  envVars: string[];
  /** 'live' when every env var is set, otherwise 'demo'. */
  mode: 'live' | 'demo';
  experimentCount: number;
  lastSyncedAt: string | null;
}
