'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import Input from '@/components/Input';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { DISCORD_FEEDS, GAME_CATCH_ALL } from '@/lib/discordFeeds';
import { MODE_CHANNELS, MODE_EVENTS_CHANNEL } from '@/lib/worldModes';

// The game modes' own channels (lib/worldModes modeChannelKey), as a SECONDARY option beside the
// main game's fields on the Webhooks page and in quick setup. Everything goes through the "What
// goes where" API (/api/admin/discord/feeds), so the keys, checks and the view are the same ones
// the Game modes tab uses. Collapsed by default: the main-game fields stay the primary thing.

interface ModeRowView {
  key: string;
  label: string;
  off: boolean;
  hookKey: string;
  ownChannelIgnored: boolean;
  events: { id: string }[];
  channelKeys: Record<string, string>;
}
interface FeedsView {
  modes: { split: boolean; rows: ModeRowView[]; channels: { id: string; label: string }[] };
  keys: Record<string, { set: boolean; channelId: string | null }>;
  channels: { enabled: boolean; channels: { id: string; name: string; parentName: string | null }[] };
}

// One shared copy for every instance on the page (ten fields would otherwise fetch ten times).
let snapshot: FeedsView | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function ensureLoaded() {
  if (snapshot || inflight) return;
  inflight = (async () => {
    try {
      const res = await clanFetch('/api/admin/discord/feeds');
      if (res.ok) snapshot = (await res.json()) as FeedsView;
    } catch {
      // Left empty: the overrides simply don't show.
    } finally {
      inflight = null;
      emit();
    }
  })();
}
async function save(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await clanFetch('/api/admin/discord/feeds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return (data as { error?: string }).error ?? 'That did not save.';
    snapshot = data as FeedsView;
    emit();
    return null;
  } catch {
    return 'That did not save.';
  }
}

function useFeedsView(): FeedsView | null {
  const view = useSyncExternalStore(subscribe, () => snapshot, () => null);
  useEffect(() => ensureLoaded(), []);
  return view;
}

/** The modes worth offering: the ones the clan hasn't switched off. */
const liveModes = (v: FeedsView) => v.modes.rows.filter((m) => !m.off);

/** The webhook page's plugin field → the mode channel it overrides (the catch-all → the mode's own channel). */
const CHANNEL_BY_FIELD: Record<string, string> = Object.fromEntries(
  DISCORD_FEEDS.filter((f) => f.tab === 'game').map((f) => [f.key, f.id]),
);
export function modeChannelForField(settingKey: string): string | null {
  if (settingKey === GAME_CATCH_ALL) return 'mode';
  return CHANNEL_BY_FIELD[settingKey] ?? null;
}

const PASTE = '__paste__';
const DEFAULT = '__default__';

/** One mode's picker for one setting: default, a server channel, or a pasted webhook. */
function ModePicker({ view, settingKey, label, defaultLabel }: { view: FeedsView; settingKey: string; label: string; defaultLabel: string }) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = view.keys[settingKey];
  const known = k?.set && k.channelId && view.channels.channels.some((c) => c.id === k.channelId);
  const value = k?.set ? (known ? k.channelId! : PASTE) : DEFAULT;
  const options = useMemo<SelectOption[]>(
    () => [
      { value: DEFAULT, label: defaultLabel },
      ...(view.channels.enabled
        ? view.channels.channels.map((c) => ({ value: c.id, label: `#${c.name}`, keywords: c.parentName ? [c.parentName.toLowerCase()] : undefined }))
        : []),
      { value: PASTE, label: k?.set && !known ? 'A pasted webhook' : 'Paste a webhook…' },
    ],
    [view, defaultLabel, k?.set, known],
  );
  const run = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const err = await save({ key: settingKey, ...body });
    setBusy(false);
    setError(err);
    return !err;
  }, [settingKey]);
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-28 text-[13px]">{label}</span>
        <Select
          className="w-60"
          value={value}
          options={options}
          ariaLabel={`${label} channel`}
          disabled={busy}
          searchable
          onChange={(v) => {
            if (v === DEFAULT) void run({ clear: true });
            else if (v === PASTE) setPasting(true);
            else void run({ channelId: v });
          }}
        />
        {busy && <span className="text-[12px] text-text-muted">Saving…</span>}
      </div>
      {pasting && (
        <div className="flex flex-wrap gap-2">
          <Input
            type="url"
            className="flex-1"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            aria-label={`${label} webhook URL`}
          />
          <button
            type="button"
            disabled={busy || !pasted.trim()}
            onClick={() =>
              void run({ webhookUrl: pasted.trim() }).then((ok) => {
                if (ok) {
                  setPasting(false);
                  setPasted('');
                }
              })
            }
            className="rounded-lg bg-gold px-3.5 py-1.5 text-[13px] font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
          >
            Save
          </button>
          <button type="button" onClick={() => setPasting(false)} className="px-2 text-[13px] text-text-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-[12px] text-accent-red">{error}</p>}
    </div>
  );
}

function Disclosure({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-card-border-soft">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-muted hover:text-foreground"
      >
        <span>{title}</span>
        {count > 0 && <span className="text-gold">· {count} set</span>}
        <span className="ml-auto">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="space-y-3 border-t border-card-border-soft px-3 py-3">{children}</div>}
    </div>
  );
}

/**
 * Under one main-game plugin field on the Webhooks page: each live game mode's own channel for the
 * same kind of post. Blank = the mode's channel, then the normal one (lib/worldModes routeModePost).
 */
export default function ModeChannelOverrides({ settingKey }: { settingKey: string }) {
  const view = useFeedsView();
  const channel = modeChannelForField(settingKey);
  if (!view || !channel) return null;
  const modes = liveModes(view);
  if (modes.length === 0) return null;
  const keyOf = (m: ModeRowView) => (channel === 'mode' ? m.hookKey : m.channelKeys[channel]);
  const set = modes.filter((m) => view.keys[keyOf(m)]?.set).length;
  return (
    <Disclosure title="Game modes (optional)" count={set}>
      <p className="text-[12px] text-text-muted">
        {channel === 'mode'
          ? "Each mode's own channel: every post from that mode without a channel of its own goes there instead of the normal channels."
          : 'Send this kind of post from a game mode somewhere else. Left on the default, it goes to the mode’s own channel, else the one above.'}
        {!view.modes.split && ' Game-mode channels are switched off on the Game modes tab, so these wait until it is on.'}
      </p>
      {modes.map((m) => (
        <ModePicker
          key={m.key}
          view={view}
          settingKey={keyOf(m)}
          label={m.label}
          defaultLabel={channel === 'mode' ? 'The normal channels' : `${m.label}'s channel / default`}
        />
      ))}
    </Disclosure>
  );
}

/**
 * Quick setup's secondary step: every live mode's channels per kind, folded away. Quick setup
 * itself only ever writes the main game's channels.
 */
export function ModeChannelsQuickSetup() {
  const view = useFeedsView();
  if (!view) return null;
  const modes = liveModes(view);
  if (modes.length === 0) return null;
  const labels = new Map(view.modes.channels.map((c) => [c.id, c.label]));
  const set = modes.reduce(
    (n, m) => n + [m.hookKey, ...Object.values(m.channelKeys)].filter((k) => view.keys[k]?.set).length,
    0,
  );
  return (
    <Disclosure title="Game modes: their own channels (optional)" count={set}>
      <p className="text-[12px] text-text-muted">
        Leagues, Deadman, hardcore and other modes post into the channels above unless you give them their own. Filters
        and the rest live on the Game modes tab under What goes where.
      </p>
      {modes.map((m) => (
        <div key={m.key} className="space-y-2 rounded-lg border border-card-border-soft p-3">
          <div className="text-[13px] font-medium">{m.label}</div>
          <ModePicker view={view} settingKey={m.hookKey} label="Everything" defaultLabel="The normal channels" />
          <Disclosure title={`${m.label} by kind of post`} count={Object.values(m.channelKeys).filter((k) => view.keys[k]?.set).length}>
            {MODE_CHANNELS.filter((ch) => ch !== MODE_EVENTS_CHANNEL || m.events.length > 0).map((ch) => (
              <ModePicker
                key={ch}
                view={view}
                settingKey={m.channelKeys[ch]}
                label={labels.get(ch) ?? ch}
                defaultLabel="Same as Everything"
              />
            ))}
          </Disclosure>
        </div>
      ))}
    </Disclosure>
  );
}
