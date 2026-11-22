/**
 * Database connection.
 *
 * - DATABASE_URL set (Railway Postgres): postgres-js driver.
 * - Not set (local dev): embedded PGlite (real Postgres in WASM) stored in
 *   ./.pglite, so the app runs without installing a database.
 */
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

export async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const db = drizzle(postgres(url, { max: 5 }), { schema });
    await migrate(db, { migrationsFolder });
    console.log('[db] connected to Postgres');
    return db as unknown as DB;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dataDir = process.env.PGLITE_DIR ?? path.resolve(process.cwd(), '.pglite');
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder });
  console.log(`[db] using embedded PGlite at ${dataDir}`);
  return db as unknown as DB;
}
