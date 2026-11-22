import { usePeeking } from '../lib/peeking';

/** Global "peeking enabled" switch. */
export function PeekToggle() {
  const { peeking, setPeeking } = usePeeking();
  return (
    <label className="group flex cursor-pointer select-none items-center gap-3">
      <span className="text-right leading-tight">
        <span className="block text-sm text-ink-900">Peeking {peeking ? 'on' : 'off'}</span>
        <span className="block text-[11px] text-ink-500">{peeking ? 'Live results visible' : 'Results under the lid'}</span>
      </span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={peeking}
          onChange={(e) => setPeeking(e.target.checked)}
          aria-label="Peeking enabled"
        />
        <span className="h-6 w-11 rounded-pill border border-line-strong bg-wash transition-colors peer-checked:border-teal-500 peer-checked:bg-teal-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-500" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-pill bg-white shadow-soft transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
