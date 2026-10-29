'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { FEED_TABS, effectiveKey, type DiscordFeed, type FeedTab } from '@/lib/discordFeeds';

interface View {
  feeds: DiscordFeed[];
  catchAlls: { site: string; game: string };
  keys: Record<string, { set: boolean; channelId: string | null }>;
  off: string[];
  channels: { enabled: boolean; channels: { id: string; name: string; parentName: string | null }[] };
}

const PASTE = '__paste__';
const FALLBACK = '__fallback__';

/**
 * Admin → Discord, "What goes where": every kind of post, on or off, and the channel it lands in —
 * its own, or the one it falls back to, said out loud instead of left to guess. `filters` renders
 * a feed's own settings (drop floors, level rules, death lines) under its row.
 */
export default function DiscordFeedsPanel({ filters }: { filters?: Partial<Record<NonNullable<DiscordFeed['filters']>, ReactNode>> }) {
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<FeedTab>('clan');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch('/api/admin/discord/feeds');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setView(data);
    else setError(data.error ?? 'Could not load your channels.');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function put(tag: string, body: Record<string, unknown>) {
    setBusy(tag);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/feeds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setView(data);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const channelName = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const c = view?.channels.channels.find((x) => x.id === id);
      return c ? `#${c.name}` : 'a channel';
    },
    [view],
  );

  /** "#drops", or "a pasted webhook", or null when the setting is blank. */
  const keyLabel = useCallback(
    (key: string) => {
      const k = view?.keys[key];
      if (!k?.set) return null;
      return channelName(k.channelId) ?? 'a pasted webhook';
    },
    [view, channelName],
  );

  const serverOptions: SelectOption[] = useMemo(
    () =>
      (view?.channels.channels ?? []).map((c) => ({
        value: c.id,
        label: `#${c.name}`,
        keywords: c.parentName ? [c.parentName.toLowerCase()] : undefined,
      })),
    [view],
  );

  if (!view) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  const isSet = (key: string) => !!view.keys[key]?.set;
  const off = new Set(view.off);
  const catchAllKey = tab === 'game' ? view.catchAlls.game : view.catchAlls.site;
  const rows = view.feeds.filter((f) => f.tab === tab);
  const tabInfo = FEED_TABS.find((t) => t.id === tab)!;

  /** The Select for one setting: its channel, the fallback, any server channel, or paste. */
  // A render helper, not a component: a component declared in here would remount (and close) on every render.
  function channelPicker(settingKey: string, fallbackLabel: string, ariaLabel: string) {
    const k = view!.keys[settingKey];
    const value = k?.set ? (k.channelId && view!.channels.channels.some((c) => c.id === k.channelId) ? k.channelId : PASTE) : FALLBACK;
    const options: SelectOption[] = [
      { value: FALLBACK, label: fallbackLabel },
      ...serverOptions,
      { value: PASTE, label: k?.set && value === PASTE ? 'A pasted webhook' : 'Paste a webhook…' },
    ];
    return (
      <Select
        className="w-60"
        value={value}
        options={options}
        ariaLabel={ariaLabel}
        disabled={busy !== null}
        searchable
        onChange={(v) => {
          if (v === FALLBACK) void put(settingKey, { key: settingKey, clear: true });
          else if (v === PASTE) setPasting(settingKey);
          else void put(settingKey, { key: settingKey, channelId: v });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-brown-dark p-4">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="text-[14px] font-semibold">{tab === 'game' ? 'In-game catch-all' : 'Catch-all channel'}</div>
          <div className="text-[12px] text-text-muted">
            {tab === 'game'
              ? 'Every in-game post without a channel of its own goes here.'
              : 'Every clan and event post without a channel of its own goes here.'}
          </div>
        </div>
        {channelPicker(catchAllKey, 'Nowhere (not set)', 'Catch-all channel')}
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-card-border">
        {FEED_TABS.map((t) => {
          const list = view.feeds.filter((f) => f.tab === t.id);
          const live = list.filter((f) => !off.has(f.id) && effectiveKey(f, isSet)).length;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-11 px-4 text-sm font-medium ${tab === t.id ? 'text-gold' : 'text-text-muted hover:text-foreground'}`}
            >
              {t.label} <span className="font-normal text-text-muted">· {live}/{list.length} posting</span>
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-text-muted">{tabInfo.blurb}</p>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}

      <ul className="rounded-xl border border-card-border bg-card-bg">
        {rows.map((f) => {
          const eff = effectiveKey(f, isSet);
          const isOff = off.has(f.id);
          const firstFallback = f.fallback.find(isSet);
          const fallbackLabel = f.fallback.length === 0 ? 'Nowhere (off)' : firstFallback ? `Same as ${keyLabel(firstFallback)}` : 'Nowhere yet (set the catch-all)';
          const where = isOff ? 'Off' : eff ? `Posts to ${keyLabel(eff)}` : 'Posts nowhere';
          return (
            <li key={f.id} className="border-b border-card-border-soft last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
                <div className="min-w-0 flex-[1_1_280px]">
                  {f.off === 'perPost' ? (
                    <div>
                      <div className="text-sm font-medium">{f.label}</div>
                      <div className="text-xs text-text-muted">{f.help}</div>
                    </div>
                  ) : (
                    <Checkbox
                      checked={!isOff}
                      disabled={busy !== null}
                      onChange={(on) => void put(f.id, { feed: f.id, off: !on })}
                      label={f.label}
                      description={f.help}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[12px] text-text-muted">
                  To
                  {channelPicker(f.key, fallbackLabel, `${f.label} channel`)}
                </div>
                <div className="w-40 text-[12px] text-text-muted">{busy === f.id || busy === f.key ? 'Saving…' : where}</div>
                {f.filters && filters?.[f.filters] && (
                  <button
                    type="button"
                    aria-expanded={open === f.id}
                    onClick={() => setOpen(open === f.id ? null : f.id)}
                    className="min-h-9 rounded-lg border border-card-border px-3 text-[13px] hover:border-gold/50"
                  >
                    Filters {open === f.id ? '▴' : '▾'}
                  </button>
                )}
              </div>
              {pasting === f.key && (
                <div className="flex flex-wrap gap-2 px-5 pb-3.5">
                  <Input
                    type="url"
                    className="flex-1"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/…"
                    aria-label={`${f.label} webhook URL`}
                  />
                  <button
                    type="button"
                    disabled={busy !== null || !pasted.trim()}
                    onClick={() =>
                      void put(f.key, { key: f.key, webhookUrl: pasted.trim() }).then((ok) => {
                        if (ok) {
                          setPasting(null);
                          setPasted('');
                        }
                      })
                    }
                    className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setPasting(null)} className="px-3 text-sm text-text-muted hover:text-foreground">
                    Cancel
                  </button>
                </div>
              )}
              {open === f.id && f.filters && (
                <div className="space-y-4 border-t border-card-border-soft bg-brown-light px-5 py-4">{filters?.[f.filters]}</div>
              )}
            </li>
          );
        })}
      </ul>
      {pasting && !rows.some((f) => f.key === pasting) && (
        <div className="flex flex-wrap gap-2">
          <Input type="url" className="flex-1" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="https://discord.com/api/webhooks/…" aria-label="Catch-all webhook URL" />
          <button
            type="button"
            disabled={busy !== null || !pasted.trim()}
            onClick={() =>
              void put(pasting, { key: pasting, webhookUrl: pasted.trim() }).then((ok) => {
                if (ok) {
                  setPasting(null);
                  setPasted('');
                }
              })
            }
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
