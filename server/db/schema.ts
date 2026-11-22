import { boolean, doublePrecision, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { DailyPoint } from '../../shared/types.js';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const experiments = pgTable(
  'experiments',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    hypothesis: text('hypothesis'),
    url: text('url'),
    primaryMetric: text('primary_metric').notNull().default('Conversion'),
    status: text('status').notNull(),
    startedAt: ts('started_at'),
    endedAt: ts('ended_at'),
    mde: real('mde').notNull().default(0.1),
    decision: text('decision'),
    decisionVariantId: integer('decision_variant_id'),
    decidedAt: ts('decided_at'),
    notes: text('notes'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('experiments_platform_external').on(t.platform, t.externalId)],
);

export const variants = pgTable(
  'variants',
  {
    id: serial('id').primaryKey(),
    experimentId: integer('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    isControl: boolean('is_control').notNull().default(false),
    visitors: integer('visitors').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    revenue: doublePrecision('revenue'),
    daily: jsonb('daily').$type<DailyPoint[]>().notNull().default([]),
  },
  (t) => [uniqueIndex('variants_experiment_external').on(t.experimentId, t.externalId)],
);

export const syncRuns = pgTable('sync_runs', {
  id: serial('id').primaryKey(),
  platform: text('platform').notNull(),
  source: text('source').notNull(), // 'demo' | 'live' | 'csv'
  experimentCount: integer('experiment_count').notNull().default(0),
  error: text('error'),
  createdAt: ts('created_at').notNull().defaultNow(),
});
