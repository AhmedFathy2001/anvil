'use client';

import { useEffect, useRef, useState } from 'react';

import type { NoticeView } from '@/lib/notices';

/**
 * The bell: notices from Anvil (lib/notices), with an unread count and a short list.
 *
 * NEAR-REALTIME, CHEAPLY. It asks for just the count when the tab comes back into focus and every
 * minute while it's visible, never while hidden. When a new unread notice turns up and the person
 * turned "Play a sound" on in /settings, it chimes once. No live chat behind it: replies happen on
 * Discord, which every notice points to.
 */
const POLL_MS = 60_000;

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Two soft notes, a fifth apart: noticeable without being an alarm.
    [
      [659.25, 0],
      [987.77, 0.12],
    ].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.55);
    });
    setTimeout(() => void ctx.close().catch(() => {}), 1200);
  } catch {
    // No audio: the badge still shows.
  }
}

const BellIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m || 1}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

// One poller for the page however many bells are mounted (the nav draws one for wide screens and one
// for phones), so the count is fetched once and the chime plays once.
type Pulse = { unread: number };
const listeners = new Set<(p: Pulse) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let newest: number | null = null;
let seeded = false;
let last: Pulse = { unread: 0 };

function publish(p: Pulse) {
  last = p;
  for (const l of listeners) l(p);
}

async function pollOnce() {
  if (document.visibilityState !== 'visible') return;
  try {
    const res = await fetch('/api/notices?count=1', { cache: 'no-store' });
    if (!res.ok) return;
    const j = (await res.json()) as { unread: number; newest: number | null; sound: boolean };
    // The first answer only seeds what "new" means, so a page load never chimes.
    if (seeded && j.newest != null && j.newest !== newest && j.sound) chime();
    newest = j.newest;
    seeded = true;
    publish({ unread: j.unread });
  } catch {
    // Offline or signed out: try again on the next tick.
  }
}

const onFocus = () => void pollOnce();

function subscribe(l: (p: Pulse) => void): () => void {
  listeners.add(l);
  l(last);
  if (listeners.size === 1) {
    void pollOnce();
    timer = setInterval(onFocus, POLL_MS);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    }
  };
}

export default function NoticeBell({ className = '' }: { className?: string }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NoticeView[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe((p) => setUnread(p.unread)), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const res = await fetch('/api/notices', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const j = (await res.json()) as { notices: NoticeView[] };
    setList(j.notices.slice(0, 5));
    // Seen in the list = read; the inbox keeps them.
    const fresh = j.notices.slice(0, 5).filter((n) => !n.read).map((n) => n.id);
    if (fresh.length) {
      await fetch('/api/notices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', ids: fresh }) }).catch(() => null);
      publish({ unread: Math.max(0, last.unread - fresh.length) });
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={unread ? `Notices from Anvil, ${unread} unread` : 'Notices from Anvil'}
        aria-expanded={open}
        title="Notices from Anvil"
        className="relative rounded-md p-2 text-gray-400 transition-all hover:bg-gold/10 hover:text-gold"
      >
        {BellIcon}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-brown-dark">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-xl">
          <div className="flex items-center justify-between border-b border-card-border px-4 py-2.5">
            <span className="text-sm font-semibold text-gold">From Anvil</span>
            <a href="/inbox" className="text-xs text-gray-400 hover:text-gold">
              Open inbox
            </a>
          </div>
          {list === null ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nothing yet. Updates from Anvil show up here.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-card-border overflow-y-auto">
              {list.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <a href="/inbox" className="block">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-sm ${n.level === 'important' ? 'text-gold' : 'text-gray-100'} ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                      <span className="shrink-0 text-[11px] text-gray-500">{ago(n.createdAt)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-gray-400">{n.body}</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
