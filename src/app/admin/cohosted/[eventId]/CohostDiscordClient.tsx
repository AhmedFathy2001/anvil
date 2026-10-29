'use client';

import { useEffect, useMemo, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import Input from '@/components/Input';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import { POST_GROUPS, type PartnerDiscordPrefs, type PartnerPreset, type PostGroup } from '@/lib/discordPostPolicy';

interface View {
  prefs: PartnerDiscordPrefs;
  hasOwnChannel: boolean;
  channels: { enabled: boolean; channels: { id: string; name: string; parentName: string | null }[] };
  host: { share: 'all' | 'big' | 'none' };
  playerRoleDefault: boolean;
}

// Which groups the "big moments" preset still lets through, for the hint beside each.
const BIG_GROUPS: PostGroup[] = ['life', 'draft', 'board'];

/**
 * A co-host clan's side of a board's Discord: what its own server shows (never more than the host
 * shares), where, who it pings, and whether its bot gives its own players the player role.
 */
export default function CohostDiscordClient({ eventId, hostName }: { eventId: number; hostName: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasted, setPasted] = useState('');
  const base = `/api/admin/cohosted/${eventId}/discord-settings`;

  useEffect(() => {
    void (async () => {
      const res = await clanFetch(base);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setView(data);
      else setError(data.error ?? 'Could not load this board’s Discord settings.');
    })();
  }, [base]);

  async function save(prefs: PartnerDiscordPrefs, channel?: { channelId?: string; webhookUrl?: string } | null) {
    if (!view) return;
    const before = view;
    setView({ ...view, prefs });
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch(base, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channel === undefined ? { prefs } : { prefs, channel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setView(data);
    } catch (e) {
      setView(before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const channelOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Your co-hosted boards channel (default)' },
      ...(view?.channels.channels ?? []).map((c) => ({ value: c.id, label: `#${c.name}` })),
    ],
    [view],
  );

  if (!view) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  const prefs = view.prefs;
  const preset = prefs.preset ?? 'host';
  const hostNone = view.host.share === 'none';
  const PRESETS: { id: PartnerPreset; name: string; desc: string }[] = [
    { id: 'host', name: 'Everything shared', desc: view.host.share === 'big' ? `${hostName} shares big moments only` : `Every post ${hostName} shares` },
    { id: 'big', name: 'Big moments', desc: 'Start, rules, draft result, wins, end' },
    { id: 'off', name: 'Nothing', desc: 'Your players follow along on the site and in game' },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-card-border bg-card-bg p-5">
      <div>
        <h2 className="font-bold">This board in your Discord</h2>
        <p className="text-sm text-text-muted">
          What your server shows of {hostName}&apos;s board. Nothing here changes the host&apos;s server or the other clans.
        </p>
      </div>
      {hostNone ? (
        <p className="rounded-lg border border-card-border bg-brown-dark p-3 text-[13px] text-text-muted">
          {hostName} keeps this board&apos;s posts to its own server, so nothing posts in yours.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                aria-pressed={preset === p.id}
                onClick={() => void save({ ...prefs, preset: p.id, groupsOff: undefined })}
                className={`flex flex-col gap-1 rounded-xl border-2 p-3 text-left ${
                  preset === p.id ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'
                }`}
              >
                <span className="text-[14px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-text-muted">{p.desc}</span>
              </button>
            ))}
          </div>
          {preset !== 'off' && (
            <div className="space-y-2 rounded-lg border border-card-border-soft p-3">
              {POST_GROUPS.map((g) => {
                const offByPreset = preset === 'big' && !BIG_GROUPS.includes(g.key);
                return (
                  <Checkbox
                    key={g.key}
                    checked={!offByPreset && !(prefs.groupsOff ?? []).includes(g.key)}
                    disabled={saving || offByPreset}
                    onChange={(on) => {
                      const off = new Set(prefs.groupsOff ?? []);
                      if (on) off.delete(g.key);
                      else off.add(g.key);
                      void save({ ...prefs, groupsOff: [...off] });
                    }}
                    label={g.label}
                    description={offByPreset ? 'Not in Big moments' : g.key === 'board' ? 'Only the big ones in Big moments: wins' : undefined}
                  />
                );
              })}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px] text-text-muted">
              Channel
              <Select
                value={prefs.channelId ?? ''}
                onChange={(channelId) => void save(prefs, channelId ? { channelId } : null)}
                options={channelOptions}
                ariaLabel="Channel"
                disabled={saving || !view.channels.enabled}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] text-text-muted">
              Ping on the start, wins and the end
              <Select
                value={prefs.ping ?? 'members'}
                onChange={(v) => void save({ ...prefs, ping: v as PartnerDiscordPrefs['ping'] })}
                options={[
                  { value: 'none', label: 'Nobody' },
                  { value: 'members', label: '@Members' },
                  { value: 'players', label: '@Bingo player' },
                ]}
                ariaLabel="Who gets pinged"
                disabled={saving}
              />
            </label>
          </div>
          {!view.channels.enabled && (
            <div className="flex gap-2">
              <Input
                type="url"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Or paste a webhook URL: https://discord.com/api/webhooks/…"
                aria-label="Webhook URL"
              />
              <button
                type="button"
                disabled={saving || !pasted.trim()}
                onClick={() => void save(prefs, { webhookUrl: pasted.trim() }).then(() => setPasted(''))}
                className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
              >
                Use
              </button>
            </div>
          )}
        </>
      )}
      <div className="border-t border-card-border-soft pt-4">
        <Checkbox
          checked={prefs.playerRole ?? view.playerRoleDefault}
          onChange={(v) => void save({ ...prefs, playerRole: v })}
          disabled={saving}
          label="Give your players the @Bingo player role"
          description="Your bot hands it out in your server, only to your own members"
        />
      </div>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </section>
  );
}
