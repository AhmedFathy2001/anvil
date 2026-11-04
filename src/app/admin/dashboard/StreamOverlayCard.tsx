'use client';

import { useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';

type View = 'standings' | 'feed' | 'board';
type Size = 's' | 'm' | 'l' | 'xl';

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: 'standings', label: 'Standings', hint: 'Top teams and how far along they are' },
  { key: 'feed', label: 'Feed', hint: 'Latest drops and finished tiles' },
  { key: 'board', label: 'Board', hint: 'The board, with finished tiles marked' },
];

const SIZES: { key: Size; label: string }[] = [
  { key: 's', label: 'S' },
  { key: 'm', label: 'M' },
  { key: 'l', label: 'L' },
  { key: 'xl', label: 'XL' },
];

/**
 * An event's stream overlay (lib/overlay): the links a streamer pastes into OBS as Browser sources,
 * a live preview, and "Reset link". Closed until opened, so the events list stays a list.
 *
 * The overlay shows exactly what the public event page shows — hidden standings stay hidden on
 * stream too — which the card says, so nobody expects the curtain to lift for their own scene.
 */
export default function StreamOverlayCard({ eventId }: { eventId: number }) {
  const { confirm, notify } = useDialog();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('standings');
  const [size, setSize] = useState<Size>('m');
  const [copied, setCopied] = useState<View | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (!open || key !== undefined) return;
    let alive = true;
    setOrigin(window.location.origin);
    clanFetch(`/api/events/${eventId}/overlay`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setKey(d && typeof d.key === 'string' ? d.key : null))
      .catch(() => alive && setKey(null));
    return () => {
      alive = false;
    };
  }, [open, key, eventId]);

  const path = (v: View) => (key ? `/overlay/${key}?view=${v}${size === 'm' ? '' : `&size=${size}`}` : '');

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true);
    try {
      const r = await clanFetch(`/api/events/${eventId}/overlay`, { method });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        notify(d.error || 'Could not update the overlay link', 'error');
        return;
      }
      setKey(typeof d.key === 'string' ? d.key : null);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const ok = await confirm({
      title: 'Reset the overlay link?',
      body: 'Every overlay made from the current link stops updating and shows a "link was reset" note. You will need to paste the new links into OBS.',
      confirmLabel: 'Reset link',
      tone: 'danger',
    });
    if (ok) await call('POST');
  }

  async function turnOff() {
    const ok = await confirm({
      title: 'Turn the overlay off?',
      body: 'The overlay links stop working. You can make new ones any time.',
      confirmLabel: 'Turn off',
      tone: 'danger',
    });
    if (ok) await call('DELETE');
  }

  async function copy(v: View) {
    const full = `${origin}${path(v)}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(v);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      notify(full);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-card-border px-3.5 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold"
      >
        Stream overlay
      </button>
    );
  }

  return (
    <div className="basis-full rounded-xl border border-card-border bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="h-5 w-1 rounded-full bg-gold" />
          Stream overlay
        </h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {key === undefined ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : key === null ? (
        <div className="space-y-3">
          <p className="max-w-[60ch] text-sm text-text-muted">
            Show the standings, the drop feed or the board on stream. Add a link to OBS as a Browser source; it updates by itself every few seconds.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => call('POST')}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {busy ? 'Making…' : 'Make overlay links'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-text-muted">Text size</span>
            {SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSize(s.key)}
                aria-pressed={size === s.key}
                className={`rounded-md border px-2.5 py-1 ${size === s.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-foreground/80 hover:border-gold/40'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {VIEWS.map((v) => (
              <li key={v.key} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={view === v.key}
                  className={`w-28 shrink-0 rounded-md border px-2.5 py-1.5 text-left text-sm ${view === v.key ? 'border-gold text-gold' : 'border-card-border text-foreground/80 hover:border-gold/40'}`}
                  title={`Preview: ${v.hint}`}
                >
                  {v.label}
                </button>
                <input
                  readOnly
                  value={`${origin}${path(v.key)}`}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`${v.label} overlay link`}
                  className="min-w-0 flex-1 rounded-md border border-card-border bg-brown-dark px-2.5 py-1.5 font-mono text-xs text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => copy(v.key)}
                  className="shrink-0 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
                >
                  {copied === v.key ? 'Copied ✓' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-1.5 text-xs text-text-muted">Preview — {VIEWS.find((v) => v.key === view)?.hint}</p>
            {/* A checkerboard behind the transparent page, so the outline reads the way it will on a scene. */}
            <iframe
              key={`${view}:${size}:${key}`}
              src={path(view)}
              title="Overlay preview"
              className="h-72 w-full rounded-lg border border-card-border"
              style={{
                backgroundColor: '#3a3a3a',
                backgroundImage:
                  'linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0,0 12px,12px -12px,-12px 0',
              }}
            />
          </div>

          <p className="max-w-[70ch] text-xs text-text-muted">
            In OBS: Sources → + → Browser, paste a link, set the size (e.g. 800×600) and leave “Custom CSS” empty. Shows
            what the public event page shows — hidden standings and unrevealed tiles stay hidden on stream. Add{' '}
            <code>&amp;limit=10</code>, <code>&amp;title=0</code> or <code>&amp;align=right</code> to a link to change it.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={reset}
              className="rounded-lg border border-card-border px-3.5 py-2 text-sm text-foreground/80 transition-colors hover:border-accent-red/60 hover:text-accent-red disabled:opacity-50"
            >
              Reset link
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={turnOff}
              className="rounded-lg px-3.5 py-2 text-sm text-text-muted transition-colors hover:text-accent-red disabled:opacity-50"
            >
              Turn off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
