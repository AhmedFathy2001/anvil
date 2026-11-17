// What a person did with a guide strip: folded it, or dismissed it. Kept in the browser only.
//
// There is no per-user preference table to put this in, and a guide is not worth a column. So it is
// localStorage, read through one small store, and every access is wrapped: with storage blocked the
// strip simply shows open every time, and the page works exactly as it would without a guide.

import type { FlowKey } from './guidedFlow.ts';

export type GuideMode = 'open' | 'folded' | 'dismissed';

const PREFIX = 'anvil.guide.';
const CHANGED = 'anvil:guide-mode';

export function guideStorageKey(flow: FlowKey, scope?: string | number | null): string {
  return `${PREFIX}${flow}${scope != null && scope !== '' ? `.${scope}` : ''}`;
}

/** The stored mode, or null when nothing was stored (or storage is not available). */
export function readGuideMode(key: string): GuideMode | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === 'open' || v === 'folded' || v === 'dismissed' ? v : null;
  } catch {
    return null;
  }
}

export function writeGuideMode(key: string, mode: GuideMode): void {
  try {
    window.localStorage.setItem(key, mode);
  } catch {
    // Storage blocked: the choice lasts for this page only (the event below still carries it).
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGED, { detail: { key, mode } }));
  } catch {
    // No events, no problem.
  }
}

/** For useSyncExternalStore: hears this tab's writes and other tabs' (the storage event). */
export function subscribeGuideMode(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export const GUIDE_MODE_EVENT = CHANGED;
