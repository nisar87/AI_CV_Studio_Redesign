/**
 * Undo/redo history with typing coalescing: consecutive edits with the same key within
 * `windowMs` replace the latest entry instead of creating one entry per keystroke.
 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null;
  lastAt: number;
};

export const LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(
  h: History<T>,
  next: T,
  key: string | null,
  now: number,
  windowMs = 1000,
): History<T> {
  if (next === h.present) return h;
  const coalesce = key !== null && key === h.lastKey && now - h.lastAt < windowMs;
  return {
    past: coalesce ? h.past : [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return {
    past: h.past.slice(0, -1),
    present: prev,
    future: [h.present, ...h.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return {
    past: [...h.past, h.present],
    present: next,
    future: h.future.slice(1),
    lastKey: null,
    lastAt: 0,
  };
}
