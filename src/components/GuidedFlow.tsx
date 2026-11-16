'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import QuickSettings from '@/components/QuickSettings';
import { useLinkCharacterHere } from '@/components/useLinkCharacterHere';
import CopyLinkButton from '@/components/CopyLinkButton';
import { revealHash } from '@/components/HashReveal';
import { clanSlugOf } from '@/lib/analyticsPattern';
import { isOptedOut } from '@/lib/analyticsSource';
import { clanFetch } from '@/lib/clanFetch';
import type { FlowLink, FlowView } from '@/lib/guidedFlow';
import {
  GUIDE_MODE_EVENT,
  guideStorageKey,
  readGuideMode,
  subscribeGuideMode,
  writeGuideMode,
  type GuideMode,
} from '@/lib/guidedFlowStore';

/**
 * The guide strip: where you are in a job, and the one thing to do next.
 *
 * One component for every flow (lib/guidedFlows), so they look and behave the same. It is a strip in
 * the page, never a dialog: it takes no focus, covers nothing, and folds to one line or goes away in
 * one click. A dismissed guide leaves a small "Show guide" control behind so it can be picked up
 * again, and a finished flow draws nothing at all.
 *
 * The view is worked out on the server from facts the page already has. The only state here is
 * whether this person folded or dismissed it, kept in the browser (lib/guidedFlowStore).
 */
export default function GuidedFlow({
  view,
  scope,
  startDismissed = false,
  onCustom,
  customBusy = false,
  error = '',
  className = 'mb-6',
}: {
  view: FlowView;
  /** Keeps two of the same flow apart in storage: an event id, a clan id. */
  scope?: string | number | null;
  /** The person already hid this guide by a means the server knows about. Storage still wins. */
  startDismissed?: boolean;
  /** Runs a `custom` action (starting an event): the page owns what it does. */
  onCustom?: (id: string) => void;
  customBusy?: boolean;
  /** Shown under the button, when the page's own action failed. */
  error?: string;
  className?: string;
}) {
  const key = guideStorageKey(view.key, scope);
  const stored = useSyncExternalStore(
    subscribeGuideMode,
    () => readGuideMode(key),
    () => null,
  );
  // With storage blocked a write is not readable back, so the choice is also held for this page.
  const [local, setLocal] = useState<GuideMode | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; mode: GuideMode }>).detail;
      if (d?.key === key) setLocal(d.mode);
    };
    window.addEventListener(GUIDE_MODE_EVENT, on);
    return () => window.removeEventListener(GUIDE_MODE_EVENT, on);
  }, [key]);
  const mode: GuideMode = stored ?? local ?? (startDismissed ? 'dismissed' : 'open');

  const pathname = usePathname();
  const linkHere = useLinkCharacterHere();
  const bodyId = useId();
  const cur = view.current;
  if (view.complete || !cur) return null;

  const position = `Step ${view.stepNumber} of ${view.total}`;
  const set = (next: GuideMode) => {
    writeGuideMode(key, next);
    if (next === 'dismissed') beacon('dismiss', view.key, cur.key);
  };

  if (mode === 'dismissed') {
    return (
      <div className={`${className} flex justify-end`}>
        <button
          type="button"
          onClick={() => set('open')}
          className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-gold/50 hover:text-gold"
        >
          Show guide: {view.name} ({position.toLowerCase()})
        </button>
      </div>
    );
  }

  const folded = mode === 'folded';
  // A blocked step's button is the thing that unblocks it.
  const link: FlowLink | null = cur.blocked ? cur.blocked.fix : cur.action.kind === 'link' ? cur.action : null;
  const onStep = () => beacon('step', view.key, cur.key);

  return (
    <section
      aria-label={`Guide: ${view.name}`}
      className={`${className} overflow-hidden rounded-xl border border-gold/30 bg-card-bg`}
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
        {/* Wraps on a phone (the Fold and Dismiss buttons left room for "Step 3 o…" and no more);
            "Step 3 of 5" itself never splits. One line from sm up. */}
        <p className="min-w-0 flex-1 text-sm sm:truncate">
          <span className="font-semibold">{view.name}</span>
          <span className="whitespace-nowrap text-text-muted"> · {position}</span>
          {folded && <span className="text-text-muted"> · {cur.title}</span>}
        </p>
        <button
          type="button"
          aria-expanded={!folded}
          aria-controls={bodyId}
          onClick={() => set(folded ? 'open' : 'folded')}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-gold"
        >
          {folded ? 'Open' : 'Fold'}
        </button>
        <button
          type="button"
          onClick={() => set('dismissed')}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:text-gold"
        >
          Dismiss<span className="sr-only"> this guide</span>
        </button>
      </div>

      <div
        role="progressbar"
        aria-label={`${view.name} progress`}
        aria-valuemin={0}
        aria-valuemax={view.total}
        aria-valuenow={view.doneCount}
        className="h-0.5 bg-card-border"
      >
        <div className="h-full bg-gold" style={{ width: `${Math.round((view.doneCount / Math.max(1, view.total)) * 100)}%` }} />
      </div>

      <div id={bodyId} hidden={folded}>
        {/* The steps, as short labels. Under phone width only the position above and the open step show. */}
        <ol className="hidden flex-wrap gap-x-4 gap-y-1 border-b border-card-border/60 px-4 py-2.5 text-xs sm:flex">
          {view.steps.map((s, i) => (
            <li
              key={s.key}
              aria-current={s.state === 'current' ? 'step' : undefined}
              className={`flex items-center gap-1.5 ${
                s.state === 'current' ? 'font-semibold text-gold' : s.state === 'done' ? 'text-accent-green-light' : 'text-text-muted'
              }`}
            >
              <span
                aria-hidden
                className={`grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px] ${
                  s.state === 'current'
                    ? 'border-gold bg-gold/15'
                    : s.state === 'done'
                      ? 'border-accent-green/50 bg-accent-green/10'
                      : 'border-card-border'
                }`}
              >
                {s.state === 'done' ? '✓' : i + 1}
              </span>
              {s.label}
              <span className="sr-only">{s.state === 'done' ? ' (done)' : s.state === 'current' ? ' (current step)' : ' (to do)'}</span>
            </li>
          ))}
        </ol>

        <div className="px-4 py-4">
          <h2 className="text-base font-semibold leading-snug">{cur.title}</h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-text-muted">{cur.sentence}</p>
          {cur.blocked && (
            <p className="mt-2 max-w-[68ch] rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {cur.blocked.reason}
            </p>
          )}
          {cur.quick && (
            <div className="mt-3 max-w-[68ch]">
              <QuickSettings view={cur.quick} mode="strip" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {link ? (
              <ClanLink
                href={link.href === '/settings/characters' && link.anchor === 'link-account' ? linkHere('start') : link.anchor ? `${link.href}#${link.anchor}` : link.href}
                className="molten-btn !px-4 !py-2 text-sm"
                onClick={() => {
                  onStep();
                  // Already on that page: the address may not change, so ask for the reveal directly.
                  if (link.anchor && samePage(pathname, link.href)) revealHash(`#${link.anchor}`);
                }}
              >
                {link.label}
              </ClanLink>
            ) : cur.action.kind === 'copy' ? (
              <span onClickCapture={onStep}>
                <CopyLinkButton path={cur.action.path} label={cur.action.label} className="molten-btn !px-4 !py-2 text-sm" />
              </span>
            ) : cur.action.kind === 'custom' && onCustom ? (
              <button
                type="button"
                disabled={customBusy}
                className="molten-btn !px-4 !py-2 text-sm"
                onClick={() => {
                  onStep();
                  if (cur.action.kind === 'custom') onCustom(cur.action.id);
                }}
              >
                {customBusy ? 'Working…' : cur.action.label}
              </button>
            ) : null}
            {cur.guideHref && (
              <ClanLink href={cur.guideHref} className="text-sm text-gold hover:text-gold-light">
                How this works
              </ClanLink>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Is the address bar already on `href` (which carries no clan prefix, while the address may)? */
function samePage(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const here = pathname.replace(/\/$/, '');
  const there = href.split('?')[0].replace(/\/$/, '');
  // The home page is '' once the slash is gone, and every path ends with that.
  return there === '' ? here === '' : here.endsWith(there);
}

/**
 * Count one use of a guide: its button pressed, or the guide dismissed. Only the flow and step keys
 * leave the browser (both fixed lists, lib/guidedFlow), and nothing at all for a browser that asked
 * not to be tracked. Never worth breaking the click over.
 */
function beacon(action: 'step' | 'dismiss', flow: string, step: string): void {
  try {
    if (isOptedOut(navigator as Navigator & { globalPrivacyControl?: boolean })) return;
    const json = JSON.stringify({ g: { a: action, f: flow, k: step }, c: clanSlugOf(window.location.pathname) });
    const blob = new Blob([json], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/analytics/collect', blob)) {
      void clanFetch('/api/analytics/collect', { method: 'POST', body: json, keepalive: true }).catch(() => {});
    }
  } catch {
    // Not recorded. The guide still works.
  }
}
