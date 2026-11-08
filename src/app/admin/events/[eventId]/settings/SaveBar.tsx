'use client';

import { useUnsavedChanges } from '@/components/UnsavedChanges';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * One save bar per settings tab. A panel with unsaved edits registers itself (useSaveBar): its name,
 * how to save it and how to throw the edits away. The bar appears while anything is waiting, names
 * what changed, saves it all in one press and warns before you leave with edits pending. A panel that
 * saved stops being dirty and drops out by itself; one that failed stays, and its own message says why.
 *
 * Panels hide their own Save button inside a tab (the hook returns true there) and keep it anywhere
 * else, so a panel works the same outside Settings.
 */

interface Entry {
  label: string;
  save: () => Promise<boolean>;
  discard: () => void;
}

const Ctx = createContext<{ set: (key: string, entry: Entry | null) => void } | null>(null);

export function SaveBarProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, Entry>>(() => new Map());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const set = useCallback((key: string, entry: Entry | null) => {
    setEntries((prev) => {
      if (!entry && !prev.has(key)) return prev;
      const next = new Map(prev);
      if (entry) next.set(key, entry);
      else next.delete(key);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ set }), [set]);

  const pending = [...entries.values()];
  const dirty = pending.length > 0;

  // Leaving (closing the tab, reloading, any in-site link) with edits pending asks first.
  useUnsavedChanges(dirty);

  async function saveAll() {
    setSaving(true);
    setFailed([]);
    const bad: string[] = [];
    // One after another: several of them PATCH the same event row, and the API merges each over it.
    for (const e of pending) {
      try {
        if (!(await e.save())) bad.push(e.label);
      } catch {
        bad.push(e.label);
      }
    }
    setFailed(bad);
    setSaving(false);
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      {dirty && (
        <div
          role="status"
          className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border bg-card-bg-hover/95 py-3 pl-5 pr-3 shadow-[0_18px_44px_rgba(0,0,0,.55)] backdrop-blur"
        >
          <div className="min-w-0 text-sm">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold align-middle" aria-hidden />
            <span className="text-text-muted">You have unsaved changes: </span>
            {pending.map((e, i) => (
              <span key={e.label}>
                {i > 0 && <span className="text-text-muted">{i === pending.length - 1 ? ' and ' : ', '}</span>}
                <b className="font-semibold text-gold">{e.label}</b>
              </span>
            ))}
            {failed.length > 0 && (
              <span className="block text-[12.5px] text-accent-red">Couldn&rsquo;t save {failed.join(', ')}: the section says why.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setFailed([]);
                for (const e of pending) e.discard();
              }}
              className="min-h-10 rounded-lg px-4 text-sm text-text-muted hover:text-foreground disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveAll}
              className="min-h-10 rounded-lg bg-gold px-5 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/**
 * Register a panel's unsaved edits with the tab's save bar. Returns true inside a settings tab (the
 * panel should hide its own Save button), false anywhere else.
 */
export function useSaveBar(key: string, label: string, dirty: boolean, save: () => Promise<boolean>, discard: () => void): boolean {
  const ctx = useContext(Ctx);
  const fns = useRef({ save, discard });
  useEffect(() => {
    fns.current = { save, discard };
  });
  useEffect(() => {
    if (!ctx) return;
    ctx.set(key, dirty ? { label, save: () => fns.current.save(), discard: () => fns.current.discard() } : null);
  }, [ctx, key, label, dirty]);
  useEffect(() => () => ctx?.set(key, null), [ctx, key]);
  return ctx != null;
}
