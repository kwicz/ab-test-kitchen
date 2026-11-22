/**
 * Peeking preference, kept per viewer in localStorage.
 *
 * - `peeking` is the global switch. Off means results stay under the lid
 *   until a test reaches its planned sample after 14 days.
 * - `peeked` holds tests the viewer chose to open anyway.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface PeekingState {
  peeking: boolean;
  setPeeking: (on: boolean) => void;
  isPeeked: (id: number) => boolean;
  peek: (id: number) => void;
  unpeek: (id: number) => void;
}

const Ctx = createContext<PeekingState | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: preference lasts for this visit only */
  }
}

export function PeekingProvider({ children }: { children: ReactNode }) {
  const [peeking, setPeekingState] = useState<boolean>(() => read('abk:peeking', true));
  const [peeked, setPeeked] = useState<number[]>(() => read('abk:peeked', []));

  const setPeeking = useCallback((on: boolean) => {
    setPeekingState(on);
    write('abk:peeking', on);
  }, []);

  const update = useCallback((fn: (ids: number[]) => number[]) => {
    setPeeked((prev) => {
      const next = fn(prev);
      write('abk:peeked', next);
      return next;
    });
  }, []);

  const value = useMemo<PeekingState>(
    () => ({
      peeking,
      setPeeking,
      isPeeked: (id) => peeked.includes(id),
      peek: (id) => update((ids) => (ids.includes(id) ? ids : [...ids, id])),
      unpeek: (id) => update((ids) => ids.filter((x) => x !== id)),
    }),
    [peeking, peeked, setPeeking, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePeeking() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePeeking must be used inside PeekingProvider');
  return ctx;
}
