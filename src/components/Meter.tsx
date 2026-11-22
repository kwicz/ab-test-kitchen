/** Thin progress meter with a label and a value. */
export function Meter({ label, value, progress, done, size = 'sm' }: { label: string; value: string; progress: number; done: boolean; size?: 'sm' | 'md' }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-2 ${size === 'md' ? 'text-sm' : 'text-[11px]'}`}>
        <span className="text-ink-500">{label}</span>
        <span className={`num ${done ? 'text-teal-600' : 'text-ink-700'}`}>
          {done && <span aria-hidden>{'✓ '}</span>}
          {value}
        </span>
      </div>
      <div
        className={`mt-1 overflow-hidden rounded-pill bg-wash ${size === 'md' ? 'h-2' : 'h-1'}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-pill transition-[width] duration-500 ${done ? 'bg-teal-500' : 'bg-teal-300'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
