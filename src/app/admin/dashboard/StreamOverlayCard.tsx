'use client';

import { useEffect, useState } from 'react';

import { useDialog } from '@/components/Confirm';
import { clanFetch, clanUrl } from '@/lib/clanFetch';
import { PANEL_KINDS, PANEL_META, type PanelKind } from '@/lib/overlay/streamPanels';

type View = 'standings' | 'feed' | 'board';
type Size = 's' | 'm' | 'l' | 'xl';

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: 'standings', label: 'Standings', hint: 'Top teams and how far along they are' },
  { key: 'feed', label: 'Feed', hint: 'Latest drops and finished tiles' },
  { key: 'board', label: 'Board', hint: 'The board, with finished tiles marked' },
];

type Theme = 'classic' | 'glass' | 'lower' | 'pixel';
const THEMES: { key: Theme; label: string; hint: string }[] = [
  { key: 'classic', label: 'Classic', hint: 'Outlined text, no box' },
  { key: 'glass', label: 'Glass', hint: 'A frosted card edged in your colour' },
  { key: 'lower', label: 'Lower third', hint: 'A broadcast bar along the bottom (the board shows as glass)' },
  { key: 'pixel', label: 'Pixel', hint: 'Hard-edged panels and blocky type' },
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
export default function StreamOverlayCard({
  eventId,
  defaultOpen = false,
  embedded = false,
}: {
  eventId: number;
  /** Open at once (a page that is only about the overlay). */
  defaultOpen?: boolean;
  /** Inside a settings section that already draws the frame and the heading: no box, no title, no Close. */
  embedded?: boolean;
}) {
  const { confirm, notify } = useDialog();
  const [open, setOpen] = useState(defaultOpen);
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('standings');
  const [size, setSize] = useState<Size>('m');
  const [celebrate, setCelebrate] = useState(true);
  const [theme, setTheme] = useState<Theme>('glass');
  // The space's own colour (lib/artPalette), from the overlay route; null = the overlay's gold.
  const [accent, setAccent] = useState<string | null>(null);
  const [copied, setCopied] = useState<View | PanelKind | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (!open || key !== undefined) return;
    let alive = true;
    setOrigin(window.location.origin);
    clanFetch(`/api/events/${eventId}/overlay`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setKey(d && typeof d.key === 'string' ? d.key : null);
        setAccent(d && typeof d.accent === 'string' ? d.accent : null);
      })
      .catch(() => alive && setKey(null));
    return () => {
      alive = false;
    };
  }, [open, key, eventId]);

  const path = (v: View) =>
    key
      ? `/overlay/${key}?view=${v}${size === 'm' ? '' : `&size=${size}`}${theme === 'classic' ? '' : `&theme=${theme}`}${
          accent ? `&accent=${accent.slice(1)}` : ''
        }${celebrate ? '&celebrate=1' : ''}`
      : '';

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

  async function copy(v: View | PanelKind, full: string) {
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
    <div className={embedded ? '' : 'basis-full rounded-xl border border-card-border bg-background/40 p-4'}>
      <div className={embedded ? 'hidden' : 'mb-3 flex items-center justify-between gap-3'}>
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

          <div>
            <span className="mb-1.5 block text-sm text-text-muted">Look</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Overlay look">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.key}
                  onClick={() => setTheme(t.key)}
                  title={t.hint}
                  className={`rounded-md border px-3 py-1.5 text-sm ${theme === t.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-foreground/80 hover:border-gold/40'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {THEMES.find((t) => t.key === theme)?.hint}
              {accent ? ' · in your space colour' : ''}
            </p>
          </div>

          <label className="flex max-w-[70ch] items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={celebrate}
              onChange={(e) => setCelebrate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
            />
            <span>
              Celebrate on stream
              <span className="block text-xs text-text-muted">
                A short pop-up when a tile is finished or a team scores. Changes the links below, so copy them again
                after switching.
              </span>
            </span>
          </label>

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
                  onClick={() => copy(v.key, `${origin}${path(v.key)}`)}
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
              key={`${view}:${size}:${theme}:${key}`}
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

      {key !== undefined && (
        <div className="mt-4">
          <PanelsSection eventId={eventId} origin={origin} copied={copied} onCopy={copy} />
        </div>
      )}
    </div>
  );
}

/**
 * Channel panels (lib/overlay/streamPanels): the images for a Twitch/Kick About section and the
 * page each one should link to. Twitch and Kick both take the link separately from the image.
 */
function PanelsSection({
  eventId,
  origin,
  copied,
  onCopy,
}: {
  eventId: number;
  origin: string;
  copied: View | PanelKind | null;
  onCopy: (k: PanelKind, full: string) => void;
}) {
  return (
    <div className="border-t border-card-border pt-4">
      <h4 className="text-sm font-semibold">Channel panels</h4>
      <p className="mb-3 mt-0.5 max-w-[70ch] text-xs text-text-muted">
        For your Twitch or Kick About section. Upload the image, then paste its link into the panel&apos;s link field.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {PANEL_KINDS.map((k) => {
          const img = clanUrl(`/api/events/${eventId}/panels/${k}`);
          const link = `${origin}${clanUrl(PANEL_META[k].path(eventId))}`;
          return (
            <li key={k} className="flex flex-col gap-2 rounded-lg border border-card-border p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated, admin-only PNG */}
              <img src={img} alt={`${PANEL_META[k].label} panel`} width={320} height={100} className="h-auto w-full rounded-md" />
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line clan-scope/clan-prefix -- img already went through clanUrl; a download needs a plain <a> */}
                <a href={`${img}?download=1`}
                  download
                  className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => onCopy(k, link)}
                  className="rounded-md border border-card-border px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-gold/40"
                  title={link}
                >
                  {copied === k ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
