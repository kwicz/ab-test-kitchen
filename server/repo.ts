/** Database reads and writes. */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Decision, Experiment, PlatformId, PlatformStatus } from '../shared/types.js';
import type { DB } from './db/client.js';
import { clients, experiments, syncRuns, variants } from './db/schema.js';
import { SCENARIOS } from './platforms/demo.js';
import { ADAPTERS } from './platforms/index.js';
import type { NormalizedExperiment } from './platforms/types.js';

export async function listClients(db: DB) {
  return db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name));
}

export async function listExperiments(db: DB, ids?: number[]): Promise<Experiment[]> {
  const rows = await db
    .select({ e: experiments, clientName: clients.name })
    .from(experiments)
    .innerJoin(clients, eq(clients.id, experiments.clientId))
    .where(ids ? inArray(experiments.id, ids) : undefined)
    .orderBy(asc(experiments.id));
  if (!rows.length) return [];
  const vs = await db.select().from(variants).where(inArray(variants.experimentId, rows.map((r) => r.e.id))).orderBy(asc(variants.id));
  return rows.map(({ e, clientName }) => ({
    ...e,
    clientName,
    platform: e.platform as PlatformId,
    status: e.status as PlatformStatus,
    decision: e.decision as Decision | null,
    variants: vs.filter((v) => v.experimentId === e.id).map(({ experimentId: _x, ...v }) => v),
  }));
}

export async function upsertExperiments(db: DB, platform: PlatformId, list: NormalizedExperiment[]): Promise<number> {
  for (const n of list) {
    const [client] = await db
      .insert(clients)
      .values({ name: n.clientName })
      .onConflictDoUpdate({ target: clients.name, set: { name: n.clientName } })
      .returning({ id: clients.id });

    // Platform-owned fields only: decisions, notes and MDE belong to the app.
    const platformFields = {
      clientId: client!.id,
      name: n.name,
      hypothesis: n.hypothesis,
      url: n.url,
      primaryMetric: n.primaryMetric,
      status: n.status,
      startedAt: n.startedAt,
      endedAt: n.endedAt,
      updatedAt: new Date().toISOString(),
    };
    const [exp] = await db
      .insert(experiments)
      .values({ platform, externalId: n.externalId, ...platformFields })
      .onConflictDoUpdate({ target: [experiments.platform, experiments.externalId], set: platformFields })
      .returning({ id: experiments.id });

    for (const v of n.variants) {
      const fields = { name: v.name, isControl: v.isControl, visitors: v.visitors, conversions: v.conversions, revenue: v.revenue, daily: v.daily };
      await db
        .insert(variants)
        .values({ experimentId: exp!.id, externalId: v.externalId, ...fields })
        .onConflictDoUpdate({ target: [variants.experimentId, variants.externalId], set: fields });
    }
  }
  return list.length;
}

export async function recordSync(db: DB, platform: PlatformId, source: 'demo' | 'live' | 'csv', experimentCount: number, error?: string) {
  await db.insert(syncRuns).values({ platform, source, experimentCount, error: error ?? null });
}

export async function lastSyncs(db: DB) {
  const rows = await db
    .select({ platform: syncRuns.platform, at: sql<string>`max(${syncRuns.createdAt})` })
    .from(syncRuns)
    .groupBy(syncRuns.platform);
  return new Map(rows.map((r) => [r.platform, r.at]));
}

export async function countsByPlatform(db: DB) {
  const rows = await db.select({ platform: experiments.platform, n: sql<number>`count(*)::int` }).from(experiments).groupBy(experiments.platform);
  return new Map(rows.map((r) => [r.platform, r.n]));
}

export async function updateExperiment(
  db: DB,
  id: number,
  patch: { decision?: Decision | null; decisionVariantId?: number | null; notes?: string | null; mde?: number },
) {
  const set: Partial<typeof experiments.$inferInsert> = { ...patch };
  if (patch.decision !== undefined) set.decidedAt = patch.decision ? new Date().toISOString() : null;
  if (patch.decision === null) set.decisionVariantId = null;
  await db.update(experiments).set(set).where(eq(experiments.id, id));
}

/** Load every platform's demo data, then apply demo decisions and notes. */
export async function seedDemo(db: DB, now = new Date()) {
  for (const adapter of Object.values(ADAPTERS)) {
    const list = adapter.normalize(adapter.demoPayload(now));
    await upsertExperiments(db, adapter.id, list);
    await recordSync(db, adapter.id, 'demo', list.length);
  }
  const all = await listExperiments(db);
  for (const s of SCENARIOS.filter((x) => x.decision)) {
    const exp = all.find((e) => e.name === s.name && e.platform === s.platform);
    if (!exp) continue;
    const v = s.decision!.variantIndex !== undefined ? exp.variants[s.decision!.variantIndex] : undefined;
    await db
      .update(experiments)
      .set({ decision: s.decision!.decision, decisionVariantId: v?.id ?? null, notes: s.decision!.notes, decidedAt: exp.endedAt })
      .where(and(eq(experiments.id, exp.id)));
  }
}

export async function resetDemo(db: DB) {
  // RESTART IDENTITY keeps test IDs (and so shared links) stable across resets.
  await db.execute(sql`TRUNCATE ${syncRuns}, ${variants}, ${experiments}, ${clients} RESTART IDENTITY CASCADE`);
  await seedDemo(db);
}

export async function isEmpty(db: DB) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(experiments);
  return (row?.n ?? 0) === 0;
}
