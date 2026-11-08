'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/components/Confirm';
import { createDirtyTracker, stableKey } from '@/lib/unsavedChanges';

/**
 * Unsaved-changes guard. A form calls useUnsavedChanges(dirty) (or useDirtyForm(values), which also
 * works out dirty). While any form is dirty: closing/reloading the tab asks (beforeunload), and a click
 * on any in-site link (ClanLink, next/link, plain <a>) asks "Leave without saving?" with the site's
 * dialog. Browser Back/Forward cannot be intercepted reliably in the App Router; beforeunload only
 * covers leaving the site.
 */

const Ctx = createContext<{ set: (id: string, dirty: boolean) => void } | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const ids = useRef(new Set<string>());
  const [any, setAny] = useState(false);
  const router = useRouter();
  const { confirm } = useDialog();
  const asking = useRef(false);

  const set = useCallback((id: string, dirty: boolean) => {
    if (dirty) ids.current.add(id);
    else ids.current.delete(id);
    setAny(ids.current.size > 0);
  }, []);
  const value = useMemo(() => ({ set }), [set]);

  useEffect(() => {
    if (!any) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // beforeunload covers leaving the site
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      if (asking.current) return;
      asking.current = true;
      void confirm({
        title: 'Leave without saving?',
        body: 'You have unsaved changes on this page. Leaving now will lose them.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        tone: 'gold',
      }).then((leave) => {
        asking.current = false;
        if (leave) {
          ids.current.clear();
          setAny(false);
          router.push(url.pathname + url.search + url.hash);
        }
      });
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', onClick, true); // capture: before the link's own handler
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', onClick, true);
    };
  }, [any, confirm, router]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Tell the guard this form has unsaved edits. Returns `dirty` so it can feed the indicator. */
export function useUnsavedChanges(dirty: boolean): boolean {
  const ctx = useContext(Ctx);
  const id = useId();
  useEffect(() => {
    ctx?.set(id, dirty);
  }, [ctx, id, dirty]);
  useEffect(() => () => ctx?.set(id, false), [ctx, id]);
  return dirty;
}

/**
 * Dirty tracking for a form: compares `values` with the last saved values (stable deep compare).
 * Clean on mount; editing and changing back is clean; call markSaved() after a successful save.
 */
export function useDirtyForm<T>(values: T, opts?: { guard?: boolean }) {
  const tracker = useRef<ReturnType<typeof createDirtyTracker<T>> | null>(null);
  if (!tracker.current) tracker.current = createDirtyTracker(values);
  const [, bump] = useState(0);
  const dirty = tracker.current.isDirty(values);
  useUnsavedChanges(opts?.guard === false ? false : dirty);
  const markSaved = useCallback(
    (saved?: T) => {
      tracker.current!.markSaved(saved ?? values);
      bump((n) => n + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableKey(values)],
  );
  return { dirty, markSaved, baseline: () => tracker.current!.baseline() };
}

/** The shared "you have unsaved changes" marker: gold dot + text, next to a Save button. */
export function UnsavedIndicator({ dirty, className = '' }: { dirty: boolean; className?: string }) {
  if (!dirty) return null;
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-gold ${className}`}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />
      You have unsaved changes
    </span>
  );
}
