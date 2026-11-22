import { useRef, useState } from 'react';
import { PLATFORM_IDS, type PlatformId, type PlatformInfo } from '../../shared/types';
import { useClients, useConfig, useCsvImport, usePlatforms, useResetDemo, useSync } from '../lib/api';
import { PLATFORM_NAMES, fmtRelative } from '../lib/format';

function PlatformCard({ p }: { p: PlatformInfo }) {
  const sync = useSync();
  const syncing = sync.isPending && sync.variables === p.id;
  return (
    <article className="flex flex-col rounded-md border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="display text-2xl leading-none">{p.name}</h3>
        <span
          className={`rounded-pill px-2.5 py-1 text-[11px] font-medium ${p.mode === 'live' ? 'bg-teal-500 text-white' : 'bg-wash text-ink-700'}`}
          title={p.mode === 'live' ? 'API credentials found' : 'No credentials set: using sample data'}
        >
          {p.mode === 'live' ? 'Live' : p.hasApi ? 'Demo data' : 'CSV import'}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-700">{p.connection}</p>
      <dl className="num mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-500">Tests</dt>
          <dd>{p.experimentCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Last synced</dt>
          <dd>{fmtRelative(p.lastSyncedAt)}</dd>
        </div>
      </dl>
      {p.envVars.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-ink-500">To go live, set on Railway:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.envVars.map((v) => (
              <code key={v} className="rounded-sm bg-wash px-1.5 py-0.5 text-[11px] text-ink-700">
                {v}
              </code>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <a href={p.docsUrl} target="_blank" rel="noreferrer" className="text-xs text-ink-500 underline-offset-4 hover:text-ink-900 hover:underline">
          Platform docs
        </a>
        <button
          type="button"
          onClick={() => sync.mutate(p.id)}
          disabled={syncing}
          className="rounded-pill border border-line px-3 py-1.5 text-sm text-ink-900 transition-colors hover:border-teal-300 hover:text-teal-600 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : p.mode === 'live' ? 'Sync now' : 'Reload sample'}
        </button>
      </div>
      {sync.error && sync.variables === p.id && <p className="mt-2 text-xs text-berry-600">{sync.error.message}</p>}
    </article>
  );
}

function CsvImport() {
  const { data: clients } = useClients();
  const importCsv = useCsvImport();
  const [platform, setPlatform] = useState<PlatformId>('shoplift');
  const [clientName, setClientName] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    importCsv.reset();
  };

  const field = 'w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink-900 focus:border-teal-300 focus:outline-none';

  return (
    <section className="rounded-lg border border-line bg-card p-5 sm:p-6">
      <h2 className="display text-3xl">Bring your own CSV</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-700">
        Export results from any platform and drop the file here. Columns are matched by name (Visitors, Sessions, Orders, Conversions, Variant, Variation and so on). One row per variant, or one row per variant per day for the trend chart.{' '}
        <a href="/api/import/template.csv" className="text-teal-600 underline underline-offset-4">
          Download the template
        </a>
        .
      </p>
      <form
        className="mt-5 grid gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (csv) importCsv.mutate({ platform, csv, clientName: clientName.trim() || undefined });
        }}
      >
        <label className="block text-sm">
          <span className="text-ink-500">Platform</span>
          <select className={`${field} mt-1`} value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
            {PLATFORM_IDS.map((id) => (
              <option key={id} value={id}>
                {PLATFORM_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-ink-500">Client (if the file has no client column)</span>
          <input list="client-list" className={`${field} mt-1`} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Ashgrove Home" />
          <datalist id="client-list">
            {clients?.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>
        <div className="text-sm">
          <span className="text-ink-500">File</span>
          <div
            className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed border-line-strong bg-canvas px-3 py-2 hover:border-teal-300"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            <span className="truncate text-ink-700">{fileName ?? 'Choose or drop a .csv'}</span>
            <span className="text-xs text-teal-600">Browse</span>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-3">
          <button type="submit" disabled={!csv || importCsv.isPending} className="rounded-pill bg-ink-900 px-4 py-2 text-sm text-white transition-colors hover:bg-teal-600 disabled:opacity-40">
            {importCsv.isPending ? 'Importing…' : 'Import tests'}
          </button>
          {importCsv.data && (
            <p className="text-sm text-teal-600">
              Imported {importCsv.data.count} test{importCsv.data.count === 1 ? '' : 's'}: {importCsv.data.names.join(', ')}.
            </p>
          )}
          {importCsv.error && <p className="text-sm text-berry-600">{importCsv.error.message}</p>}
        </div>
        {importCsv.data?.warnings.length ? (
          <ul className="list-disc pl-5 text-xs text-honey-600 md:col-span-3">
            {importCsv.data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </section>
  );
}

export function Pantry() {
  const { data: platforms, isLoading } = usePlatforms();
  const { data: config } = useConfig();
  const reset = useResetDemo();

  return (
    <div>
      <p className="font-script text-2xl text-teal-500">Where the ingredients come from</p>
      <h1 className="display mt-1 text-5xl leading-[1.05] sm:text-6xl">Pantry</h1>
      <p className="mt-3 max-w-2xl text-ink-700">
        Each platform has a connector. Without API keys it serves sample data in that platform's own format, run through the same parser a live connection uses. Add the keys on Railway and the next sync pulls real tests.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Platforms">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-md bg-wash" />)}
        {platforms?.map((p) => <PlatformCard key={p.id} p={p} />)}
      </section>

      <div className="mt-10">
        <CsvImport />
      </div>

      {config?.demoMode && (
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6 text-sm text-ink-500">
          <span>Played with the demo? Restore the original sample kitchen.</span>
          <button
            type="button"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="rounded-pill border border-line px-3 py-1.5 text-ink-900 transition-colors hover:border-line-strong disabled:opacity-50"
          >
            {reset.isPending ? 'Resetting…' : 'Reset demo data'}
          </button>
          {reset.isSuccess && <span className="text-teal-600">Done.</span>}
        </div>
      )}
    </div>
  );
}
