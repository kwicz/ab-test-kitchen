/**
 * Forgiving CSV importer.
 *
 * Accepts the app's own template and most platform exports by matching
 * column names against known aliases. Rows can be one per variant (totals)
 * or one per variant per day (daily); daily rows are summed into totals.
 */
import Papa from 'papaparse';
import type { DailyPoint, PlatformStatus } from '../../shared/types.js';
import { num, toIso, type NormalizedExperiment, type NormalizedVariant } from './types.js';

const ALIASES = {
  experimentId: ['test id', 'experiment id', 'experience id', 'campaign id', 'rollout id'],
  experiment: ['test', 'test name', 'experiment', 'experiment name', 'experience', 'experience name', 'campaign', 'campaign name', 'rollout', 'rollout name'],
  client: ['client', 'store', 'shop', 'project', 'project name', 'account', 'brand'],
  variant: ['variant', 'variant name', 'variation', 'variation name', 'arm', 'group', 'version', 'theme'],
  variantId: ['variant id', 'variation id'],
  isControl: ['is control', 'control', 'baseline', 'is baseline'],
  visitors: ['visitors', 'unique visitors', 'users', 'sessions', 'participants', 'visitors count'],
  conversions: ['conversions', 'orders', 'purchases', 'transactions', 'converted'],
  revenue: ['revenue', 'net revenue', 'total revenue', 'sales', 'total sales'],
  date: ['date', 'day'],
  status: ['status', 'state'],
  startDate: ['start date', 'started', 'started at', 'start'],
  endDate: ['end date', 'ended', 'ended at', 'end'],
  url: ['url', 'page', 'target url', 'targeting'],
  hypothesis: ['hypothesis', 'description'],
  metric: ['metric', 'goal', 'primary metric', 'primary goal'],
} as const;

type Field = keyof typeof ALIASES;

const norm = (h: string) => h.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();

export function mapHeaders(headers: string[]): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    const match = headers.find((h) => (ALIASES[field] as readonly string[]).includes(norm(h)));
    if (match) out[field] = match;
  }
  return out;
}

export function parseStatus(v: string | undefined, hasData: boolean): PlatformStatus {
  const s = (v ?? '').toLowerCase();
  if (/draft|not.?started|pending|scheduled|setup/.test(s)) return 'draft';
  if (/pause/.test(s)) return 'paused';
  if (/stop|end|complete|conclude|archiv|finish/.test(s)) return 'stopped';
  if (/run|live|active|start/.test(s)) return 'running';
  return hasData ? 'running' : 'draft';
}

const CONTROL_NAME = /^(control|original|baseline|default|a)$|control|original|baseline|current/i;
const truthy = (v: string | undefined) => /^(1|true|yes|y|x)$/i.test((v ?? '').trim());
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface CsvResult {
  experiments: NormalizedExperiment[];
  warnings: string[];
}

export function parseCsv(text: string, opts: { defaultClient?: string; idPrefix?: string } = {}): CsvResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const cols = mapHeaders(headers);
  const warnings: string[] = parsed.errors.slice(0, 5).map((e) => `Row ${e.row ?? '?'}: ${e.message}`);

  const missing = (['experiment', 'variant', 'visitors', 'conversions'] as Field[]).filter((f) => !cols[f]);
  if (missing.length) {
    const label: Partial<Record<Field, string>> = { experiment: 'test name', variant: 'variant', visitors: 'visitors (or sessions)', conversions: 'conversions (or orders)' };
    throw new Error(`Missing column(s): ${missing.map((f) => label[f]).join(', ')}. Found: ${headers.join(', ') || 'none'}.`);
  }
  if (!cols.client && !opts.defaultClient) {
    throw new Error('No client/store column found. Pick a client for this file.');
  }

  const get = (row: Record<string, string>, f: Field) => (cols[f] ? row[cols[f]!]?.trim() : undefined);

  interface Acc {
    exp: NormalizedExperiment;
    variants: Map<string, NormalizedVariant & { dailyMap: Map<string, DailyPoint> }>;
    statusRaw?: string;
  }
  const byExp = new Map<string, Acc>();

  for (const row of parsed.data) {
    const name = get(row, 'experiment');
    const variantName = get(row, 'variant');
    if (!name || !variantName) continue;
    const client = get(row, 'client') || opts.defaultClient!;
    const extId = `${opts.idPrefix ?? ''}${get(row, 'experimentId') || slug(`${client}-${name}`)}`;

    let acc = byExp.get(extId);
    if (!acc) {
      acc = {
        exp: {
          externalId: extId,
          clientName: client,
          name,
          hypothesis: get(row, 'hypothesis') || null,
          url: get(row, 'url') || null,
          primaryMetric: get(row, 'metric') || 'Orders',
          status: 'running',
          startedAt: toIso(get(row, 'startDate')),
          endedAt: toIso(get(row, 'endDate')),
          variants: [],
        },
        variants: new Map(),
        statusRaw: get(row, 'status'),
      };
      byExp.set(extId, acc);
    }

    const vKey = get(row, 'variantId') || slug(variantName);
    let v = acc.variants.get(vKey);
    if (!v) {
      v = {
        externalId: vKey,
        name: variantName,
        isControl: cols.isControl ? truthy(get(row, 'isControl')) : false,
        visitors: 0,
        conversions: 0,
        revenue: cols.revenue ? 0 : null,
        daily: [],
        dailyMap: new Map(),
      };
      acc.variants.set(vKey, v);
    }

    const visitors = num(get(row, 'visitors'));
    const conversions = num(get(row, 'conversions'));
    v.visitors += visitors;
    v.conversions += conversions;
    if (v.revenue !== null) v.revenue += num(get(row, 'revenue'));

    const dateIso = toIso(get(row, 'date'));
    if (dateIso) {
      const date = dateIso.slice(0, 10);
      const p = v.dailyMap.get(date) ?? { date, visitors: 0, conversions: 0 };
      p.visitors += visitors;
      p.conversions += conversions;
      v.dailyMap.set(date, p);
    }
  }

  const experiments = [...byExp.values()].map(({ exp, variants, statusRaw }) => {
    const list = [...variants.values()];
    if (!list.some((v) => v.isControl)) {
      const byName = list.find((v) => CONTROL_NAME.test(v.name));
      (byName ?? list[0])!.isControl = true;
      if (!byName && list.length > 1) warnings.push(`"${exp.name}": no control column or name, so "${list[0]!.name}" was used as control.`);
    }
    const allDates = list.flatMap((v) => [...v.dailyMap.keys()]).sort();
    exp.startedAt ??= allDates[0] ? `${allDates[0]}T00:00:00.000Z` : null;
    const hasData = list.some((v) => v.visitors > 0);
    exp.status = parseStatus(statusRaw, hasData);
    if (exp.status === 'stopped' && !exp.endedAt && allDates.length) exp.endedAt = `${allDates.at(-1)}T23:59:59.000Z`;
    exp.variants = list
      .sort((a, b) => Number(b.isControl) - Number(a.isControl))
      .map(({ dailyMap, ...v }) => ({ ...v, revenue: v.revenue === null ? null : Math.round(v.revenue * 100) / 100, daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)) }));
    return exp;
  });

  return { experiments, warnings };
}

export const CSV_TEMPLATE = [
  'Test ID,Test Name,Client,Status,Variant,Is Control,Date,Visitors,Conversions,Revenue,URL,Hypothesis',
  'hero-01,Homepage hero copy,Your Client,Running,Original,yes,2026-11-01,1200,36,1620.00,example.com,Benefit-led copy beats brand copy.',
  'hero-01,Homepage hero copy,Your Client,Running,Benefit headline,no,2026-11-01,1185,41,1845.50,example.com,Benefit-led copy beats brand copy.',
  'hero-01,Homepage hero copy,Your Client,Running,Original,yes,2026-11-02,1240,38,1710.00,example.com,Benefit-led copy beats brand copy.',
  'hero-01,Homepage hero copy,Your Client,Running,Benefit headline,no,2026-11-02,1229,44,1980.25,example.com,Benefit-led copy beats brand copy.',
].join('\n');
