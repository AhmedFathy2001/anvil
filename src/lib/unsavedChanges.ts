/**
 * Pure half of "unsaved changes": a stable deep compare and a baseline tracker. A form is dirty when
 * its current values differ from the last SAVED values, so editing a value and editing it back is
 * clean, and nothing is flagged on mount (the baseline starts as the initial values).
 */

function norm(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Set) return [...v].map(norm).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (v instanceof Map) return norm(Object.fromEntries(v));
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined && typeof x !== 'function') out[k] = norm(x);
    }
    return out;
  }
  return v;
}

/** Key order and undefined-vs-missing do not matter; array order does. */
export function stableKey(v: unknown): string {
  return JSON.stringify(norm(v));
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  return stableKey(a) === stableKey(b);
}

export interface DirtyTracker<T> {
  isDirty(current: T): boolean;
  /** Call after a successful save: the current values become the new baseline. */
  markSaved(current: T): void;
  baseline(): T;
}

export function createDirtyTracker<T>(initial: T): DirtyTracker<T> {
  let saved = stableKey(initial);
  let base = initial;
  return {
    isDirty: (current) => stableKey(current) !== saved,
    markSaved: (current) => {
      saved = stableKey(current);
      base = current;
    },
    baseline: () => base,
  };
}
