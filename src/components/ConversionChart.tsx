import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Variant } from '../../shared/types';
import { SERIES, fmtPct } from '../lib/format';

interface Row {
  date: string;
  [variantKey: string]: number | string;
}

/** Cumulative conversion rate per variant, day by day. */
export function ConversionChart({ variants }: { variants: Variant[] }) {
  const days = variants[0]?.daily.length ?? 0;
  if (days < 2) return <p className="py-10 text-center text-sm text-ink-500">Not enough daily data to chart yet.</p>;

  const totals = variants.map(() => ({ v: 0, c: 0 }));
  const rows: Row[] = [];
  for (let d = 0; d < days; d++) {
    const row: Row = { date: variants[0]!.daily[d]!.date };
    variants.forEach((v, i) => {
      const p = v.daily[d];
      if (!p) return;
      totals[i]!.v += p.visitors;
      totals[i]!.c += p.conversions;
      row[`v${v.id}`] = totals[i]!.v ? totals[i]!.c / totals[i]!.v : 0;
    });
    rows.push(row);
  }

  const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-700" aria-label="Legend">
        {variants.map((v, i) => (
          <li key={v.id} className="flex items-center gap-2">
            <svg width="18" height="6" aria-hidden>
              <line x1="1" y1="3" x2="17" y2="3" stroke={SERIES[i] ?? SERIES[3]} strokeWidth="2" strokeDasharray={v.isControl ? '4 3' : undefined} strokeLinecap="round" />
            </svg>
            {v.name}
            {v.isControl && <span className="text-ink-400">(control)</span>}
          </li>
        ))}
      </ul>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: 'var(--color-ink-500)' }} tickLine={false} axisLine={{ stroke: 'var(--color-line-strong)' }} minTickGap={28} />
            <YAxis tickFormatter={(n: number) => fmtPct(n, 1)} tick={{ fontSize: 11, fill: 'var(--color-ink-500)' }} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: 'var(--color-ink-300)', strokeWidth: 1 }}
              contentStyle={{ borderRadius: 10, border: '1px solid var(--color-line)', boxShadow: 'var(--shadow-lift)', fontSize: 12 }}
              labelFormatter={(l) => shortDate(String(l))}
              formatter={(value, key) => {
                const v = variants.find((x) => `v${x.id}` === key);
                return [fmtPct(Number(value), 2), v?.name ?? String(key)];
              }}
            />
            {variants.map((v, i) => (
              <Line
                key={v.id}
                type="monotone"
                dataKey={`v${v.id}`}
                stroke={SERIES[i] ?? SERIES[3]}
                strokeWidth={2}
                strokeDasharray={v.isControl ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-500">Cumulative conversion rate. Early days swing; lines settle as data builds.</p>
    </div>
  );
}
