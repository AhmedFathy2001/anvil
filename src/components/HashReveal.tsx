'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { hashTargetId } from '@/lib/hashTarget';

/**
 * Arriving at `#some-setting` should leave no doubt which line on the page that was: scroll to it,
 * open any folded section it sits in, and ring it in gold for a moment.
 *
 * Next scrolls to a hash it can find, but never opens a <details>, never says which line it meant,
 * and finds nothing when the target renders after a fetch (every PlainSetting / ToggleSetting shows
 * "Loading…" first). So this looks for the element for a few seconds, then does all three.
 *
 * ONE implementation for the admin area: the settings search, links between pages (#feeds from the
 * Discord page, #fees from an event's sign-ups) and a pasted address all land the same way. Mounted
 * once by the admin layout; the search calls `revealHash` itself for a jump within the same page,
 * which changes no pathname and fires no hashchange.
 */

const FLASH = 'anvil-hash-flash';
/** Fired with the target id before looking for it, so a panel can switch to the tab that holds it. */
const REVEAL_EVENT = 'anvil:reveal-target';
const FLASH_MS = 2600;
const LOOK_FOR_MS = 4000;
const STEP_MS = 100;
const FALLBACK_AFTER_MS = 2000;

let pending: ReturnType<typeof setTimeout> | null = null;

/** Ring one element briefly. Restarting the class restarts the animation on a repeat visit. */
export function flashElement(el: HTMLElement) {
  el.classList.remove(FLASH);
  void el.offsetWidth;
  el.classList.add(FLASH);
  window.setTimeout(() => el.classList.remove(FLASH), FLASH_MS);
}

/**
 * Find `#id` (waiting for it to render), open its folds, scroll to it and ring it. `fallback` is
 * another id to land on if `id` never shows — a card that only renders sometimes ("Remove old
 * webhooks from other plugins" appears only when there are some), so the jump still ends somewhere that explains it.
 */
export function revealHash(hash: string, fallback?: string) {
  const id = hashTargetId(hash);
  if (pending) clearTimeout(pending);
  pending = null;
  if (!id) return;
  window.dispatchEvent(new CustomEvent<string>(REVEAL_EVENT, { detail: id }));
  let waited = 0;
  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      waited += STEP_MS;
      // Its stand-in has rendered and the target still hasn't after a fair wait: it isn't coming.
      const standIn = fallback && fallback !== id && waited >= FALLBACK_AFTER_MS && document.getElementById(fallback);
      if (standIn) revealHash(fallback);
      else if (waited < LOOK_FOR_MS) pending = setTimeout(tick, STEP_MS);
      else if (fallback && fallback !== id) revealHash(fallback);
      return;
    }
    pending = null;
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    // A folded section opens downwards, so its top is what you want to see; a single line reads best
    // in the middle of the screen, clear of the sticky header.
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: el instanceof HTMLDetailsElement ? 'start' : 'center', behavior: smooth ? 'smooth' : 'auto' });
    flashElement(el);
  };
  tick();
}

/**
 * For a panel whose targets hide behind its own tabs or folds (Discord's "What goes where", "Post
 * without a bot"): `onTarget(id)` runs for the address's hash when the panel mounts and for every
 * later reveal, so the panel can open the tab that holds `id`. The reveal then finds it once shown.
 */
export function useRevealTarget(onTarget: (id: string) => void) {
  const latest = useRef(onTarget);
  useEffect(() => {
    latest.current = onTarget;
  });
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      try {
        latest.current(decodeURIComponent(hash));
      } catch {
        latest.current(hash);
      }
    }
    const on = (e: Event) => latest.current((e as CustomEvent<string>).detail);
    window.addEventListener(REVEAL_EVENT, on);
    return () => window.removeEventListener(REVEAL_EVENT, on);
  }, []);
}

export default function HashReveal() {
  const pathname = usePathname();

  // A new page under the admin layout (the layout itself stays mounted, so this keys on the path).
  useEffect(() => {
    if (window.location.hash) revealHash(window.location.hash);
  }, [pathname]);

  // A hash link on the same page, or the back button between two anchors.
  useEffect(() => {
    const onHash = () => revealHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    // Next's <Link> changes the hash with history.pushState, which fires no hashchange — so a link
    // from one section of a page to another (or to the same page from its own rail) never scrolled
    // the admin pane. Watch the history calls too; the pathname effect above covers cross-page moves.
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const wrap = (orig: typeof history.pushState): typeof history.pushState =>
      function (this: History, ...args) {
        const before = window.location.href;
        const out = orig.apply(this, args);
        const after = window.location.href;
        if (before !== after && window.location.hash) setTimeout(() => revealHash(window.location.hash), 0);
        return out;
      };
    history.pushState = wrap(origPush);
    history.replaceState = wrap(origReplace);
    return () => {
      window.removeEventListener('hashchange', onHash);
      if (history.pushState !== origPush) history.pushState = origPush;
      if (history.replaceState !== origReplace) history.replaceState = origReplace;
    };
  }, []);

  return null;
}
