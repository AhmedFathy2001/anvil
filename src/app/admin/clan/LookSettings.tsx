'use client';

import { useEffect, useState } from 'react';

import ClanCrest from '@/components/ClanCrest';
import { useDialog } from '@/components/Confirm';
import { accentTokens, normalizeHex } from '@/lib/artPalette';
import { clanFetch } from '@/lib/clanFetch';

const API = '/api/admin/clan/look';
/** What an unset accent means everywhere: the site's own gold. */
const ANVIL_GOLD = '#e0aa1e';

interface Look {
  accent: string | null;
  palette: string[];
  logoUrl: string | null;
  bannerUrl: string | null;
  space: boolean;
}

/**
 * "Colours": the accent a clan or creator space uses on its own pages (lib/artPalette), picked from
 * swatches pulled out of its logo and banner, or any colour. A live preview shows it the way a
 * visitor will, and the contrast rules (text lightened when too dark, dark or white button ink)
 * are the same ones the pages apply, so what you see here is what they get.
 */
export default function LookSettings({ name }: { name: string }) {
  const { notify } = useDialog();
  const [look, setLook] = useState<Look | null>(null);
  const [pick, setPick] = useState<string>(ANVIL_GOLD);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    clanFetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Look) => {
        if (!alive) return;
        setLook(d);
        setPick(d.accent ?? ANVIL_GOLD);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return null;
  if (!look) return <section className="mb-6 h-40 animate-pulse rounded-xl border border-card-border bg-card-bg" aria-busy="true" />;

  const saved = look.accent ?? ANVIL_GOLD;
  const dirty = pick !== saved;
  const t = accentTokens(pick);
  const noArt = !look.logoUrl && !look.bannerUrl;
  const where = look.space ? 'your space page, event pages, the join flow and your overlay' : 'your clan page and event pages';

  async function save(next: string | null) {
    setSaving(true);
    try {
      const r = await clanFetch(API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        notify(d.error || 'Could not save the colour.', 'error');
        return;
      }
      setLook(d as Look);
      setPick((d as Look).accent ?? ANVIL_GOLD);
    } finally {
      setSaving(false);
    }
  }

  function applyCustom() {
    const hex = normalizeHex(custom);
    if (hex) setPick(hex);
    else notify('Type a colour like #a78bfa.', 'error');
  }

  const swatches = [...new Set([...look.palette, ANVIL_GOLD])];

  return (
    <section id="colours" className="mb-6 scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <span className="h-5 w-1 rounded-full bg-gold" />
        Colours
      </h2>
      <p className="mb-4 max-w-[64ch] text-sm text-text-muted">
        One colour for {where}. We pull a few from your logo and banner; pick the one that feels like you.
      </p>

      <div className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[999_1_340px] space-y-4">
          <div>
            <p className="mb-2 text-xs text-text-muted">
              {noArt ? 'Upload a logo or banner above and its colours show up here.' : 'From your art'}
            </p>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
              {swatches.map((hex) => {
                const on = hex === pick;
                return (
                  <button
                    key={hex}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={hex === ANVIL_GOLD ? 'Anvil gold' : hex}
                    title={hex === ANVIL_GOLD ? 'Anvil gold (default)' : hex}
                    onClick={() => setPick(hex)}
                    className={`h-11 w-11 rounded-xl border-2 transition-transform hover:scale-105 ${on ? 'border-foreground' : 'border-transparent'}`}
                    style={{ background: hex, boxShadow: on ? 'inset 0 0 0 3px var(--card-bg)' : undefined }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="color"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-card-border bg-transparent"
                aria-label="Pick any colour"
              />
              or type one
            </label>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
              placeholder="#a78bfa"
              aria-label="Colour code"
              className="w-28 rounded-lg border border-card-border bg-brown-dark px-3 py-2 font-mono text-sm"
            />
            <button type="button" onClick={applyCustom} className="rounded-lg border border-card-border px-3 py-2 text-sm hover:border-gold/40">
              Use
            </button>
          </div>

          <p className="text-xs text-text-muted">
            {t.adjusted
              ? 'That colour is too dark to read on a dark page, so text uses a lighter shade of it. Buttons and fills keep it as picked.'
              : 'Reads well on dark pages.'}{' '}
            Button text is {t.ink === '#ffffff' ? 'white' : 'dark'} on it.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => save(pick === ANVIL_GOLD ? null : pick)}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save colour'}
            </button>
            {dirty && (
              <button type="button" onClick={() => setPick(saved)} className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-foreground">
                Discard
              </button>
            )}
            {look.accent && !dirty && (
              <button type="button" disabled={saving} onClick={() => save(null)} className="rounded-lg px-3 py-2 text-sm text-text-muted hover:text-foreground">
                Back to Anvil gold
              </button>
            )}
          </div>
        </div>

        {/* The preview: the same tokens the public pages use. */}
        <div className="min-w-0 flex-[1_1_280px] max-w-sm" aria-label="Preview">
          <p className="mb-2 text-xs uppercase tracking-wider text-text-muted">Preview</p>
          <div className="overflow-hidden rounded-2xl border border-card-border" style={{ background: '#0f0c0b' }}>
            <div className="h-24" style={{ backgroundColor: t.deep }}>
              {look.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- the clan's own upload, previewed
                <img src={look.bannerUrl} alt="" className="h-full w-full object-cover opacity-90" />
              )}
            </div>
            <div className="-mt-8 px-4 pb-4">
              <div className="inline-block rounded-2xl border-4" style={{ borderColor: '#0f0c0b' }}>
                <ClanCrest name={name} logoUrl={look.logoUrl} size={60} rounded="rounded-xl" className="text-xl" />
              </div>
              <div className="mt-2 text-xl font-bold">{name}</div>
              <span className="mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: t.soft, color: t.text }}>
                Bingo · running now
              </span>
              <div className="mt-3 flex min-h-11 items-center justify-center rounded-xl text-sm font-bold" style={{ background: t.accent, color: t.ink }}>
                Join the event
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
