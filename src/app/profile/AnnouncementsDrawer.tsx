'use client';

import { useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Select from '@/components/Select';
import Input from '@/components/Input';
import type { EmissionSettingsView, EmissionState } from '@/lib/emissionSettings';

const KIND_LABELS: Record<string, string> = {
  rareDrops: 'Rare drops',
  deaths: 'Deaths',
  combatAchievements: 'Combat achievements',
  pvpKills: 'PvP kills',
};
const KINDS = Object.keys(KIND_LABELS);

const STATE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'always', label: 'Always announce' },
  { value: 'never', label: 'Never' },
];

/**
 * "Where do my announcements go" — the /profile face of lib/emissionRouting.
 *
 * The distinction the copy leans on, because it is the one people get wrong: this is about the SOCIAL
 * stuff — drops, pets, deaths, combat achievements. A bingo submission is EVIDENCE and always reaches
 * the clan running the board; nothing here can send it somewhere else or hold it back.
 */
export default function AnnouncementsDrawer({
  initial,
  defaultOpen = false,
}: {
  initial: EmissionSettingsView;
  /** Open on first render — used on the apex /profile where this is a primary purpose of the page,
      rather than a footnote drawer at the bottom of a clan locker. */
  defaultOpen?: boolean;
}) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/emissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'That didn’t work.');
      else setView(data as EmissionSettingsView);
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  // Anything to configure on the clan side? (a guest clan, or a member clan an alt could be pointed at)
  const hasClanControls = view.accounts.some((a) => a.clans.length > 0) || view.memberClans.length > 0;

  return (
    <details open={defaultOpen || undefined} className="group mt-5 rounded-xl border border-card-border bg-card-bg">
      <summary className="flex cursor-pointer list-none select-none items-center gap-2.5 px-5 py-4 font-semibold">
        <span className="text-text-muted transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        Announcements
        <span className="text-xs font-normal text-text-muted">drops, deaths, CAs — where they post</span>
      </summary>

      <div className="grid gap-6 px-5 pb-5">
        <p className="max-w-[70ch] text-[13px] text-text-muted">
          Where your drops, pets, deaths and combat achievements get announced across your clans. Your
          bingo submissions aren&rsquo;t affected — those always reach the clan running the board.
        </p>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">{error}</div>
        )}

        {/* The user-side block. */}
        <Checkbox
          checked={view.blockGuestEmissions}
          onChange={(v) => patch({ blockGuestEmissions: v })}
          disabled={busy}
          label="Keep my announcements out of clans I only guest in"
          description="Your own clan and your bingo boards are unaffected. Allow specific clans below."
        />

        {/* Per-account, per-clan controls. */}
        {hasClanControls && (
          <div className="grid gap-4">
            {view.accounts.map((a) => {
              // Member clans this account has no row for — the "point an alt here" options.
              const pointable = view.memberClans.filter(
                (mc) => mc.clanId !== a.memberClan?.clanId && !a.clans.some((c) => c.clanId === mc.clanId),
              );
              if (a.clans.length === 0 && pointable.length === 0) return null;
              return (
                <div key={a.accountId} className="rounded-lg border border-card-border/60 bg-brown-dark/30 p-3.5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    {a.rsn}
                    {a.shared && (
                      <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold">
                        shared
                      </span>
                    )}
                    {a.memberClan && (
                      <span className="text-[11px] font-normal text-text-muted">· member of {a.memberClan.name}</span>
                    )}
                  </div>

                  {a.clans.length > 0 && (
                    <ul className="grid gap-1.5">
                      {a.clans.map((c) => (
                        <li key={c.clanId} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-[13px]">
                            {c.name}
                            <span className="ml-1.5 text-[11px] text-text-muted">
                              {c.seat === 'guest' ? 'guest' : 'pointed here'}
                            </span>
                          </span>
                          <Select
                            value={c.state}
                            onChange={(v) => patch({ accountId: a.accountId, clanId: c.clanId, state: v as EmissionState })}
                            options={STATE_OPTIONS}
                            ariaLabel={`Announcements for ${a.rsn} in ${c.name}`}
                            className="w-40 shrink-0"
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  {pointable.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11px] text-text-muted">Also announce to a clan you&rsquo;re a member of:</span>
                      <Select
                        value=""
                        onChange={(v) => v && patch({ accountId: a.accountId, clanId: Number(v), state: 'always' })}
                        options={[{ value: '', label: 'Add…' }, ...pointable.map((mc) => ({ value: String(mc.clanId), label: mc.name }))]}
                        ariaLabel={`Point ${a.rsn} at a clan you are a member of`}
                        className="w-44"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-px bg-card-border" />

        {/* Personal webhooks. */}
        <WebhookSection view={view} onChange={setView} />
      </div>
    </details>
  );
}

function WebhookSection({
  view,
  onChange,
}: {
  view: EmissionSettingsView;
  onChange: (v: EmissionSettingsView) => void;
}) {
  const [url, setUrl] = useState('');
  const [kinds, setKinds] = useState<Set<string>>(new Set(KINDS));
  const [minRarity, setMinRarity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The list is refreshed from the emissions view; keep a local copy so add/remove feel instant.
  const [hooks, setHooks] = useState(view.webhooks);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, kinds: [...kinds], minRarity: minRarity || null }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Could not add that.');
      else {
        setHooks((h) => [...h, data.webhook]);
        onChange({ ...view, webhooks: [...hooks, data.webhook] });
        setUrl('');
        setMinRarity('');
      }
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/profile/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const next = hooks.filter((h) => h.id !== id);
      setHooks(next);
      onChange({ ...view, webhooks: next });
    }
  }

  return (
    <div>
      <div className="text-sm font-semibold">Your own webhooks</div>
      <p className="mb-3 mt-0.5 max-w-[70ch] text-[12.5px] text-text-muted">
        Send copies of your notifications to your own Discord channels, independent of any clan. Paste a
        webhook from a channel&rsquo;s Integrations → Webhooks.
      </p>

      {hooks.length > 0 && (
        <ul className="mb-3 grid gap-1.5">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-card-border/60 bg-brown-dark/30 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{h.label ?? maskUrl(h.url)}</span>
                <span className="block text-[11px] text-text-muted">
                  {h.kinds.map((k) => KIND_LABELS[k] ?? k).join(', ')}
                  {h.minRarity != null ? ` · ≥ ${h.minRarity.toLocaleString()} gp` : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="shrink-0 rounded-md border border-card-border px-2.5 py-1 text-[12px] text-text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2.5 rounded-lg border border-card-border/60 bg-brown-dark/30 p-3">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          className="text-xs"
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {KINDS.map((k) => (
            <Checkbox
              key={k}
              checked={kinds.has(k)}
              onChange={(on) =>
                setKinds((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(k);
                  else next.delete(k);
                  return next;
                })
              }
              labelClassName="text-xs"
              label={KIND_LABELS[k]}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-muted">Only drops worth at least</span>
          <Input
            value={minRarity}
            onChange={(e) => setMinRarity(e.target.value)}
            inputMode="numeric"
            placeholder="any"
            className="w-28 text-xs"
          />
          <span className="text-[12px] text-text-muted">gp (optional)</span>
          <button
            type="button"
            onClick={add}
            disabled={busy || !url.trim() || kinds.size === 0}
            className="ml-auto rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            Add webhook
          </button>
        </div>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}

/** Show a webhook without its secret token — the id segment is enough to tell two apart. */
function maskUrl(url: string): string {
  const m = /webhooks\/(\d+)\//.exec(url);
  return m ? `Discord webhook …${m[1].slice(-4)}` : 'Discord webhook';
}
