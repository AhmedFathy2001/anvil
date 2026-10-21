'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';
import Select, { type SelectOption } from '@/components/Select';
import type { BroadcastChannel } from '@/lib/discord-broadcast';
import {
  BASE_KEY,
  QUICK_SETUP_GROUPS,
  quickSetupLabel,
  suggestReuse,
  type QuickSetupLayout,
} from '@/lib/discordQuickSetup';

interface ForeignWebhook {
  id: string;
  name: string;
  channelId: string;
  channelName: string;
}
interface RouteNow {
  settingKey: string;
  channelId: string | null;
  channelName: string | null;
}
interface SetupRow {
  settingKey: string;
  channelId: string | null;
  channelName: string | null;
  created: boolean;
  error?: string;
}

const PRIMARY =
  'px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const SECONDARY =
  'px-4 py-2 bg-card-bg-hover border border-card-border text-text font-semibold rounded-lg text-sm hover:border-gold/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const LINK = 'text-sm text-gold hover:underline';

const LAYOUTS: { id: QuickSetupLayout; title: string; blurb: string; recommended?: boolean }[] = [
  { id: 'one', title: 'One channel', blurb: 'Everything in one place. Best for small clans.' },
  {
    id: 'few',
    title: 'A few channels',
    blurb: 'Drops & pets, deaths, and achievements each get their own.',
    recommended: true,
  },
  { id: 'all', title: 'Every kind on its own', blurb: 'Drops, pets, deaths, levels, collection log and PvP each separate.' },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-card-border rounded-xl p-5 bg-card-bg space-y-4">
      <h2 className="display text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// Quick setup writes every kind sharing a channel separately, so the summary folds them back to
// one line per channel: "Drops, Pets → #drops".
function groupByChannel(rows: { settingKey: string; channelId: string | null; channelName: string | null }[]) {
  const groups: { key: string; channelName: string | null; settingKeys: string[] }[] = [];
  for (const r of rows) {
    const key = r.channelId ?? `link:${r.settingKey}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.settingKeys.push(r.settingKey);
    else groups.push({ key, channelName: r.channelName, settingKeys: [r.settingKey] });
  }
  return groups;
}

function labelFor(layout: QuickSetupLayout | null, settingKey: string): string {
  const fromLayout = layout ? QUICK_SETUP_GROUPS[layout].find((t) => t.settingKey === settingKey)?.label : undefined;
  return fromLayout ?? quickSetupLabel(settingKey);
}

/** Opens the "Change channels by hand" section and scrolls to it. */
function openByHand() {
  const el = document.getElementById('discord-by-hand') as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * The simple path through Admin → Discord: find Dink's webhooks, set up channels in one click, tell
 * members, then clean up. Everything here is also reachable by hand below it.
 */
export default function DiscordQuickSetup({
  channels,
  siteUrl,
  onRoutingChanged,
}: {
  channels: BroadcastChannel[];
  siteUrl: string;
  onRoutingChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [foreign, setForeign] = useState<ForeignWebhook[]>([]);
  const [current, setCurrent] = useState<RouteNow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await clanFetch('/api/admin/discord/foreign-webhooks');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setLoadError(data.error || (data.enabled === false ? null : 'Couldn’t read your server’s webhooks.'));
        setForeign([]);
        setCurrent([]);
      } else {
        setLoadError(null);
        setForeign(data.webhooks ?? []);
        setCurrent(data.current ?? []);
      }
    } catch {
      setLoadError('Couldn’t read your server’s webhooks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Setup ----
  const [useSame, setUseSame] = useState(true);
  const [layout, setLayout] = useState<QuickSetupLayout>('few');
  const [redo, setRedo] = useState(false);
  const [running, setRunning] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [result, setResult] = useState<{ layout: QuickSetupLayout; rows: SetupRow[]; notes: string[] } | null>(null);

  async function runSetup() {
    setRunning(true);
    setSetupError(null);
    try {
      const reuse = useSame && foreign.length > 0 ? suggestReuse(foreign, layout) : {};
      const res = await clanFetch('/api/admin/discord/quick-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout, reuse }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupError(data.error || 'Setup failed.');
        return;
      }
      setResult({ layout, rows: data.rows ?? [], notes: data.notes ?? [] });
      setRedo(false);
      onRoutingChanged();
      void load();
    } catch {
      setSetupError('Setup failed.');
    } finally {
      setRunning(false);
    }
  }

  // ---- Tell your members ----
  const announceTitle = 'We’re moving our Discord posts to Anvil';
  const announceBody = `Install the Anvil plugin and sign in with Discord. Then turn off Dink’s notifications so nothing posts twice. Two minutes: ${siteUrl}/guide/switching`;
  const [announceChannel, setAnnounceChannel] = useState('');
  const [posting, setPosting] = useState(false);
  const [postMsg, setPostMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const channelOptions = useMemo<SelectOption[]>(
    () => channels.map((c) => ({ value: c.id, label: `#${c.name}`, keywords: c.parentName ? [c.parentName] : undefined })),
    [channels],
  );

  async function postAnnouncement() {
    setPosting(true);
    setPostMsg(null);
    try {
      const res = await clanFetch('/api/admin/discord/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: announceChannel, title: announceTitle, body: announceBody, asEmbed: true }),
      });
      const data = await res.json().catch(() => ({}));
      setPostMsg(res.ok ? { ok: true, text: 'Posted.' } : { ok: false, text: data.error || 'Couldn’t post it.' });
    } catch {
      setPostMsg({ ok: false, text: 'Couldn’t post it.' });
    } finally {
      setPosting(false);
    }
  }

  // ---- Remove old webhooks ----
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeMsg, setRemoveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function removePicked() {
    setRemoving(true);
    setRemoveMsg(null);
    try {
      const res = await clanFetch('/api/admin/discord/foreign-webhooks/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...picked] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRemoveMsg({ ok: false, text: data.error || 'Couldn’t remove them.' });
      } else {
        const results = (data.results ?? []) as { id: string; ok: boolean; error?: string }[];
        const done = results.filter((r) => r.ok).length;
        const failed = results.filter((r) => !r.ok);
        setRemoveMsg({
          ok: failed.length === 0,
          text:
            `Removed ${done} ${done === 1 ? 'webhook' : 'webhooks'}.` +
            (failed.length ? ` ${failed.length} couldn’t be removed: ${failed[0].error ?? 'unknown error'}` : ''),
        });
        setPicked(new Set());
      }
    } catch {
      setRemoveMsg({ ok: false, text: 'Couldn’t remove them.' });
    } finally {
      setRemoving(false);
      setConfirming(false);
      void load();
    }
  }

  if (loading) return <p className="text-sm text-text-muted">Checking your server…</p>;

  const foreignChannels = [...new Set(foreign.map((w) => w.channelName))];
  const alreadySetUp = current.length > 0;
  const showChooser = !alreadySetUp || redo;

  return (
    <div className="space-y-4">
      {loadError && (
        <p className="text-sm text-amber-400 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2">{loadError}</p>
      )}

      {foreign.length > 0 && (
        <Card title="Coming from Dink?">
          <p className="text-sm text-text-muted">
            The bot found {foreign.length} {foreign.length === 1 ? 'webhook' : 'webhooks'} that{' '}
            {foreign.length === 1 ? 'isn’t' : 'aren’t'} Anvil’s in{' '}
            {foreignChannels.map((n, i) => (
              <span key={n}>
                {i > 0 && ', '}
                <span className="text-foreground">#{n}</span>
              </span>
            ))}
            . Anvil can post into those same channels, so nothing moves for your members.
          </p>
          <Checkbox checked={useSame} onChange={setUseSame} label="Use the same channels" />
        </Card>
      )}

      <Card title="Where should posts go?">
        {result && (
          <div className="space-y-2">
            <ul className="space-y-1.5">
              {result.rows.map((r) => (
                <li key={r.settingKey} className="flex items-center gap-3 text-sm">
                  {r.error ? (
                    <span className="text-red-400">
                      ✗ {labelFor(result.layout, r.settingKey)}: {r.error}
                    </span>
                  ) : (
                    <span>
                      <span className="text-gold">✓</span> {labelFor(result.layout, r.settingKey)} →{' '}
                      <span className="text-foreground">#{r.channelName}</span>
                      {r.created && <span className="text-text-muted"> (new)</span>}
                    </span>
                  )}
                  <button type="button" onClick={openByHand} className={cn(LINK, 'ml-auto shrink-0')}>
                    Change
                  </button>
                </li>
              ))}
            </ul>
            {result.notes.map((n) => (
              <p key={n} className="text-xs text-text-muted">
                {n}
              </p>
            ))}
          </div>
        )}

        {!result && alreadySetUp && !redo && (
          <div className="space-y-2">
            <ul className="space-y-1.5">
              {groupByChannel(current).map((g) => (
                <li key={g.key} className="flex items-center gap-3 text-sm">
                  <span>
                    {current.length === 1 && g.settingKeys[0] === BASE_KEY
                      ? 'Everything'
                      : g.settingKeys.map((k) => labelFor(null, k)).join(', ')}{' '}
                    →{' '}
                    <span className="text-foreground">
                      {g.channelName ? `#${g.channelName}` : 'a pasted link'}
                    </span>
                  </span>
                  <button type="button" onClick={openByHand} className={cn(LINK, 'ml-auto shrink-0')}>
                    Change
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setRedo(true)} className={LINK}>
              Redo setup
            </button>
          </div>
        )}

        {result && !redo && (
          <button type="button" onClick={() => setRedo(true)} className={LINK}>
            Redo setup
          </button>
        )}

        {showChooser && (!result || redo) && (
          <>
            <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Channel layout">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={layout === l.id}
                  onClick={() => setLayout(l.id)}
                  className={cn(
                    'text-left rounded-xl border p-4 transition-colors',
                    layout === l.id ? 'border-gold/60 bg-gold/10' : 'border-card-border hover:border-gold/30',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-3.5 w-3.5 rounded-full border shrink-0',
                        layout === l.id ? 'border-gold bg-gold' : 'border-text-muted',
                      )}
                    />
                    <span className="font-medium">{l.title}</span>
                  </span>
                  <span className="block text-sm text-text-muted mt-1.5">{l.blurb}</span>
                  {l.recommended && <span className="block text-xs text-gold mt-2">Recommended</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={runSetup} disabled={running} className={PRIMARY}>
                {running ? 'Setting it up…' : 'Set it up for me'}
              </button>
              {redo && (
                <button type="button" onClick={() => setRedo(false)} className={SECONDARY}>
                  Cancel
                </button>
              )}
              {setupError && <span className="text-sm text-red-400">{setupError}</span>}
            </div>
          </>
        )}
      </Card>

      <Card title="Tell your members">
        <div className="rounded-lg border-l-4 border-gold bg-black/20 px-4 py-3">
          <p className="font-semibold">{announceTitle}</p>
          <p className="text-sm text-text-muted mt-1 break-words">{announceBody}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="sm:w-72">
            <Select
              value={announceChannel}
              onChange={setAnnounceChannel}
              options={channelOptions}
              placeholder="Pick a channel"
              ariaLabel="Channel to post in"
              searchable
            />
          </div>
          <button type="button" onClick={postAnnouncement} disabled={!announceChannel || posting} className={PRIMARY}>
            {posting ? 'Posting…' : 'Post it'}
          </button>
          {postMsg && <span className={cn('text-sm', postMsg.ok ? 'text-gold' : 'text-red-400')}>{postMsg.text}</span>}
        </div>
      </Card>

      {(foreign.length > 0 || removeMsg) && (
        <Card title="Remove Dink’s old webhooks">
          {foreign.length > 0 ? (
            <>
              <p className="text-sm text-text-muted">
                Once your members are on Anvil, tick the ones to remove. Removed webhooks stop posting for good.
              </p>
              <div className="space-y-2">
                {foreign.map((w) => (
                  <Checkbox
                    key={w.id}
                    checked={picked.has(w.id)}
                    onChange={(on) => {
                      setConfirming(false);
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(w.id);
                        else next.delete(w.id);
                        return next;
                      });
                    }}
                    label={
                      <>
                        {w.name} <span className="text-text-muted">— #{w.channelName}</span>
                      </>
                    }
                  />
                ))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={picked.size === 0}
                    className={SECONDARY}
                  >
                    Remove {picked.size} {picked.size === 1 ? 'webhook' : 'webhooks'}…
                  </button>
                ) : (
                  <>
                    <span className="text-sm text-text-muted">This can’t be undone.</span>
                    <button
                      type="button"
                      onClick={removePicked}
                      disabled={removing}
                      className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      {removing ? 'Removing…' : 'Yes, remove them'}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} disabled={removing} className={SECONDARY}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
          {removeMsg && <p className={cn('text-sm', removeMsg.ok ? 'text-gold' : 'text-red-400')}>{removeMsg.text}</p>}
        </Card>
      )}
    </div>
  );
}
