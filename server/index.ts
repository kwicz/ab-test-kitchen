import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PLATFORM_IDS, type PlatformInfo } from '../shared/types.js';
import { connect } from './db/client.js';
import { CSV_TEMPLATE, parseCsv } from './platforms/csv.js';
import { ADAPTERS, isPlatformId } from './platforms/index.js';
import { hasLiveCredentials } from './platforms/types.js';
import * as repo from './repo.js';

const db = await connect();
if (await repo.isEmpty(db)) {
  console.log('[seed] empty database, loading demo kitchen');
  await repo.seedDemo(db);
}

const demoMode = process.env.DEMO_MODE !== 'off';
const app = new Hono();

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/clients', async (c) => c.json(await repo.listClients(db)));

app.get('/api/experiments', async (c) => c.json(await repo.listExperiments(db)));

app.get('/api/experiments/:id', async (c) => {
  const [exp] = await repo.listExperiments(db, [Number(c.req.param('id'))]);
  return exp ? c.json(exp) : c.json({ error: 'Not found' }, 404);
});

const Patch = z.object({
  decision: z.enum(['winner', 'loser', 'inconclusive']).nullable().optional(),
  decisionVariantId: z.number().int().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  mde: z.number().min(0.01).max(1).optional(),
});

app.patch('/api/experiments/:id', async (c) => {
  const body = Patch.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.message }, 400);
  const id = Number(c.req.param('id'));
  await repo.updateExperiment(db, id, body.data);
  const [exp] = await repo.listExperiments(db, [id]);
  return c.json(exp);
});

app.get('/api/platforms', async (c) => {
  const [counts, syncs] = await Promise.all([repo.countsByPlatform(db), repo.lastSyncs(db)]);
  const out: PlatformInfo[] = PLATFORM_IDS.map((id) => {
    const a = ADAPTERS[id];
    return {
      id,
      name: a.name,
      connection: a.connection,
      docsUrl: a.docsUrl,
      hasApi: Boolean(a.fetchLive),
      envVars: a.envVars,
      mode: hasLiveCredentials(a) ? 'live' : 'demo',
      experimentCount: counts.get(id) ?? 0,
      lastSyncedAt: syncs.get(id) ?? null,
    };
  });
  return c.json(out);
});

app.post('/api/platforms/:id/sync', async (c) => {
  const id = c.req.param('id');
  if (!isPlatformId(id)) return c.json({ error: 'Unknown platform' }, 404);
  const adapter = ADAPTERS[id];
  const live = hasLiveCredentials(adapter);
  try {
    const list = live ? await adapter.fetchLive!(process.env) : adapter.normalize(adapter.demoPayload(new Date()));
    const n = await repo.upsertExperiments(db, id, list);
    await repo.recordSync(db, id, live ? 'live' : 'demo', n);
    return c.json({ source: live ? 'live' : 'demo', count: n });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await repo.recordSync(db, id, live ? 'live' : 'demo', 0, msg);
    return c.json({ error: msg }, 502);
  }
});

const CsvBody = z.object({
  platform: z.enum(PLATFORM_IDS),
  clientName: z.string().trim().min(1).optional(),
  csv: z.string().min(1).max(5_000_000),
});

app.post('/api/import/csv', async (c) => {
  const body = CsvBody.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: body.error.message }, 400);
  try {
    const { experiments, warnings } = parseCsv(body.data.csv, { defaultClient: body.data.clientName });
    if (!experiments.length) return c.json({ error: 'No test rows found in that file.' }, 400);
    const n = await repo.upsertExperiments(db, body.data.platform, experiments);
    await repo.recordSync(db, body.data.platform, 'csv', n);
    return c.json({ count: n, warnings, names: experiments.map((e) => e.name) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

app.get('/api/import/template.csv', (c) =>
  c.body(CSV_TEMPLATE, 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ab-test-kitchen-template.csv"' }),
);

app.post('/api/demo/reset', async (c) => {
  if (!demoMode) return c.json({ error: 'Demo reset is off' }, 403);
  await repo.resetDemo(db);
  return c.json({ ok: true });
});

app.get('/api/config', (c) => c.json({ demoMode }));

// Production: serve the built client and fall back to index.html for client routes.
if (process.env.NODE_ENV === 'production') {
  const root = path.resolve(process.cwd(), 'dist/client');
  const indexHtml = await readFile(path.join(root, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), root) }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found' }, 404) : c.html(indexHtml)));
}

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`[api] listening on http://localhost:${port}`));
