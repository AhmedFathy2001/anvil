'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import DateTimePicker from '@/components/DateTimePicker';
import Input from '@/components/Input';
import NumberInput from '@/components/NumberInput';
import Select, { type SelectOption } from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import {
  DISCORD_POST_TYPES,
  POST_GROUPS,
  decideHostPost,
  detectPreset,
  isPaused,
  presetPosts,
  type ClanEventRoleDefaults,
  type DiscordPostType,
  type EventDiscordPrefs,
  type EventRoleSettings,
  type PingChoice,
  type PostGroup,
} from '@/lib/discordPostPolicy';
import type { PartnerReadiness } from '@/lib/partnerDiscordReadiness';
import { POSTS_LABEL } from '@/lib/partnerReadiness';

interface Channel {
  id: string;
  name: string;
  parentName: string | null;
}

interface View {
  prefs: EventDiscordPrefs;
  hasOwnChannel: boolean;
  channels: { enabled: boolean; channels: Channel[] };
  clanDefaults: {
    posts: Partial<Record<DiscordPostType, boolean>>;
    pings: Partial<Record<DiscordPostType, PingChoice>>;
    roles: ClanEventRoleDefaults;
    teamChannels: boolean;
  };
  roles: EventRoleSettings;
  partners: PartnerReadiness[];
}

const PING_LABEL: Record<PingChoice, string> = { none: 'Nobody', members: '@Members', players: '@Bingo player' };

/** A row of buttons, one pressed — the house pattern for a small set of choices. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap overflow-hidden rounded-lg border border-card-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50 ${
            value === o.value ? 'bg-gold font-semibold text-brown-dark' : 'bg-brown-dark text-text-muted hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-card-border bg-card-bg">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/**
 * An event's Discord tab: on top of the clan's defaults, which posts go out, who they ping, where,
 * a pause, what co-hosts may show, and the team-channel and role timing. Every change saves at once.
 */
export default function EventDiscordClient({ eventId, hasCohosts }: { eventId: number; hasCohosts: boolean }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [destOwn, setDestOwn] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pauseUntil, setPauseUntil] = useState('');
  const [days, setDays] = useState<number | null>(null);

  const base = `/api/admin/events/${eventId}/discord-settings`;

  const apply = useCallback((data: View) => {
    setView(data);
    setDestOwn(data.hasOwnChannel);
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await clanFetch(base);
      const data = await res.json().catch(() => ({}));
      if (res.ok) apply(data);
      else setError(data.error ?? 'Could not load this event’s Discord settings.');
    })();
  }, [base, apply]);

  async function save(prefs: EventDiscordPrefs, channel?: { channelId?: string; webhookUrl?: string } | null) {
    if (!view) return;
    const before = view;
    setView({ ...view, prefs }); // optimistic
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
      apply(data);
    } catch (e) {
      setView(before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const prefs = view?.prefs ?? {};
  const clanPosts = useMemo(() => ({ posts: view?.clanDefaults.posts ?? {}, pings: view?.clanDefaults.pings ?? {} }), [view]);
  const preset = detectPreset(prefs.posts);
  const paused = isPaused(prefs);

  const setPosts = (posts: EventDiscordPrefs['posts']) => save({ ...prefs, posts });
  const setPost = (type: DiscordPostType, v: 'default' | 'on' | 'off') => {
    const posts = { ...(prefs.posts ?? {}) };
    if (v === 'default') delete posts[type];
    else posts[type] = v;
    void setPosts(posts);
  };
  const setGroup = (group: PostGroup, v: 'default' | 'on' | 'off') => {
    const posts = { ...(prefs.posts ?? {}) };
    for (const t of DISCORD_POST_TYPES) {
      if (t.group !== group) continue;
      if (v === 'default') delete posts[t.key];
      else posts[t.key] = v;
    }
    void setPosts(posts);
  };
  const setPing = (type: DiscordPostType, v: string) => {
    const pings = { ...(prefs.pings ?? {}) };
    if (v === 'default') delete pings[type];
    else pings[type] = v as PingChoice;
    void save({ ...prefs, pings });
  };

  const channelOptions: SelectOption[] = useMemo(
    () =>
      (view?.channels.channels ?? []).map((c) => ({
        value: c.id,
        label: `#${c.name}`,
        keywords: c.parentName ? [c.parentName.toLowerCase()] : undefined,
      })),
    [view],
  );

  if (!view) {
    return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;
  }

  const decided = DISCORD_POST_TYPES.map((t) => ({ t, d: decideHostPost(t.key, clanPosts, prefs) }));
  const onCount = decided.filter((x) => x.d.send).length;
  const pingCount = decided.filter((x) => x.d.send && x.d.ping !== 'none').length;
  const changed = Object.keys(prefs.posts ?? {}).length + Object.keys(prefs.pings ?? {}).length;
  const ownChannel = view.prefs.channelId ? view.channels.channels.find((c) => c.id === view.prefs.channelId) : null;
  const destLabel = view.hasOwnChannel ? (ownChannel ? `#${ownChannel.name}` : 'this event’s own channel') : 'your clan’s bingo channel';

  const PRESETS = [
    { id: 'clan', name: 'Clan defaults', desc: 'Same as every other event' },
    { id: 'quiet', name: 'Quiet', desc: 'Only start, rules, winner and end' },
    { id: 'silent', name: 'Silent', desc: 'Nothing posts. Good for test runs' },
    { id: 'custom', name: 'Custom', desc: 'Your own mix, below' },
  ] as const;

  const roles = view.roles;
  const clanRoles = view.clanDefaults.roles;
  const onOff = (b: boolean) => (b ? 'on' : 'off');

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_640px] space-y-6">
        <div className="space-y-3">
          <p className="text-[14px] text-text-muted">
            This event follows your clan&apos;s Discord settings unless you change something here. Changes apply to
            this event only and save as you make them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={saving || p.id === 'custom'}
                aria-pressed={preset === p.id}
                onClick={() => p.id !== 'custom' && setPosts(presetPosts(p.id))}
                className={`flex flex-col gap-1 rounded-xl border-2 p-3.5 text-left transition-colors ${
                  preset === p.id ? 'border-gold bg-gold/10' : 'border-card-border bg-card-bg hover:border-gold/40'
                } ${p.id === 'custom' && preset !== 'custom' ? 'cursor-default opacity-60' : ''}`}
              >
                <span className="text-[14px] font-semibold">{p.name}</span>
                <span className="text-[12px] text-text-muted">{p.desc}</span>
              </button>
            ))}
          </div>
          {error && <p className="text-[13px] text-accent-red">{error}</p>}
        </div>

        <Section title="Where it posts">
          <div className="space-y-4 text-[13px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { own: false, name: 'Your clan’s bingo channel', desc: 'Set in Admin → Discord' },
                { own: true, name: 'A channel just for this event', desc: 'Pick one in your server, or paste a webhook' },
              ].map((o) => (
                <button
                  key={String(o.own)}
                  type="button"
                  disabled={saving}
                  aria-pressed={destOwn === o.own}
                  onClick={() => {
                    setDestOwn(o.own);
                    if (!o.own && view.hasOwnChannel) void save(prefs, null);
                  }}
                  className={`flex flex-col gap-1 rounded-xl border-2 p-3.5 text-left ${
                    destOwn === o.own ? 'border-gold bg-gold/10' : 'border-card-border hover:border-gold/40'
                  }`}
                >
                  <span className="font-semibold">{o.name}</span>
                  <span className="text-[12px] text-text-muted">{o.desc}</span>
                </button>
              ))}
            </div>
            {destOwn && (
              <div className="flex flex-wrap items-end gap-3">
                {view.channels.enabled && (
                  <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-[12px] text-text-muted">
                    Channel in your server
                    <Select
                      value={view.prefs.channelId ?? ''}
                      onChange={(channelId) => void save(prefs, { channelId })}
                      options={channelOptions}
                      placeholder={view.hasOwnChannel && !ownChannel ? 'A pasted webhook' : 'Pick a channel…'}
                      ariaLabel="Event channel"
                      disabled={saving}
                    />
                  </label>
                )}
                {view.channels.enabled && <span className="pb-2 text-[12px] text-text-muted">or</span>}
                <div className="flex min-w-60 flex-1 flex-col gap-1.5 text-[12px] text-text-muted">
                  <span>Paste a webhook URL</span>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      placeholder="https://discord.com/api/webhooks/…"
                      aria-label="Webhook URL"
                    />
                    <button
                      type="button"
                      disabled={saving || !pasted.trim()}
                      onClick={() => void save(prefs, { webhookUrl: pasted.trim() }).then(() => setPasted(''))}
                      className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold/90 disabled:opacity-50"
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            )}
            {hasCohosts && (
              <div className="grid gap-4 border-t border-card-border-soft pt-4 sm:grid-cols-2">
                <Checkbox
                  checked={prefs.cohosts !== false}
                  onChange={(v) => void save({ ...prefs, cohosts: v })}
                  disabled={saving}
                  label="Also post to co-hosts’ channels"
                  description="Each co-host still chooses what it shows"
                />
                <label className="flex flex-col gap-1.5 text-[12px] text-text-muted">
                  The most co-hosts may show
                  <Select
                    value={prefs.partnerShare ?? 'all'}
                    onChange={(v) => void save({ ...prefs, partnerShare: v as EventDiscordPrefs['partnerShare'] })}
                    options={[
                      { value: 'all', label: 'Everything' },
                      { value: 'big', label: 'Big moments only' },
                      { value: 'none', label: 'Nothing' },
                    ]}
                    ariaLabel="What co-hosts may show"
                    disabled={saving || prefs.cohosts === false}
                  />
                </label>
              </div>
            )}
            {view.partners.length > 0 && <PartnerList partners={view.partners} />}
          </div>
        </Section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="h-5 w-1 rounded-full bg-gold" />
              What it posts
            </h2>
            <span className="text-[12px] text-text-muted">
              <b className="text-foreground">Default</b> follows your clan&apos;s setting
            </span>
          </div>
          {POST_GROUPS.map((g) => {
            const rows = decided.filter((x) => x.t.group === g.key);
            const on = rows.filter((x) => x.d.send).length;
            return (
              <div key={g.key} className="rounded-2xl border border-card-border bg-card-bg">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-card-border bg-card-bg-hover px-5 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">{g.label}</div>
                    <div className="text-[12px] text-text-muted">
                      {on} of {rows.length} posting
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['on', 'off', 'default'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={saving}
                        onClick={() => setGroup(g.key, v)}
                        className="min-h-9 rounded-lg border border-card-border px-3 text-[12px] text-text-muted hover:text-foreground disabled:opacity-50"
                      >
                        {v === 'on' ? 'All on' : v === 'off' ? 'All off' : 'Reset'}
                      </button>
                    ))}
                  </div>
                </div>
                <ul>
                  {rows.map(({ t, d }) => {
                    const clanOn = clanPosts.posts[t.key] ?? true;
                    const clanPing = clanPosts.pings[t.key] ?? (t.ping ? 'members' : 'none');
                    return (
                      <li key={t.key} className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-card-border-soft px-5 py-3 last:border-b-0">
                        <div className="min-w-0 flex-[1_1_220px]">
                          <div className="flex items-center gap-2 text-[14px] font-medium">
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 rounded-full ${d.send ? 'bg-gold' : 'border border-text-dim'}`}
                            />
                            {t.label}
                          </div>
                          <div className="pl-4 text-[12px] text-text-muted">{t.help}</div>
                        </div>
                        <Segmented
                          ariaLabel={t.label}
                          disabled={saving}
                          value={prefs.posts?.[t.key] ?? 'default'}
                          onChange={(v) => setPost(t.key, v)}
                          options={[
                            { value: 'default', label: `Default · ${clanOn ? 'on' : 'off'}` },
                            { value: 'on', label: 'On' },
                            { value: 'off', label: 'Off' },
                          ]}
                        />
                        <label className="flex items-center gap-2 text-[12px] text-text-muted">
                          Ping
                          <Select
                            className="w-48"
                            value={prefs.pings?.[t.key] ?? 'default'}
                            onChange={(v) => setPing(t.key, v)}
                            disabled={saving || !d.send}
                            ariaLabel={`Who ${t.label} pings`}
                            options={[
                              { value: 'default', label: `Default (${PING_LABEL[clanPing]})` },
                              { value: 'none', label: 'Nobody' },
                              { value: 'members', label: '@Members' },
                              { value: 'players', label: '@Bingo player' },
                            ]}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>

        <Section title="Roles & team channels">
          <div className="divide-y divide-card-border-soft text-[13px]">
            <div className="flex flex-wrap items-center gap-4 pb-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <div className="font-medium">Team channels &amp; roles</div>
                <div className="text-[12px] text-text-muted">A private text and voice channel and a role for each team, made when the draft finishes</div>
              </div>
              <Segmented
                ariaLabel="Team channels"
                disabled={saving}
                value={prefs.teamChannels ?? 'default'}
                onChange={(v) => void save({ ...prefs, teamChannels: v === 'default' ? undefined : v })}
                options={[
                  { value: 'default', label: `Default · ${onOff(view.clanDefaults.teamChannels)}` },
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 py-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <div className="font-medium">Clean up team channels &amp; roles</div>
                <div className="text-[12px] text-text-muted">Delete them afterwards so old events don&apos;t pile up</div>
              </div>
              <Segmented
                ariaLabel="Cleanup"
                disabled={saving}
                value={prefs.cleanup?.mode ?? 'default'}
                onChange={(v) =>
                  void save({
                    ...prefs,
                    cleanup: v === 'default' ? undefined : v === 'after' ? { mode: 'after', days: prefs.cleanup?.days ?? 7 } : { mode: v },
                  })
                }
                options={[
                  { value: 'default', label: `Default · ${clanRoles.cleanup ? cleanupLabel(clanRoles.cleanup) : 'never'}` },
                  { value: 'never', label: 'Never' },
                  { value: 'end', label: 'At the end' },
                  { value: 'after', label: 'After…' },
                ]}
              />
              {prefs.cleanup?.mode === 'after' && (
                <span className="flex items-center gap-2 text-[12px] text-text-muted">
                  <NumberInput
                    className="w-20"
                    value={days ?? prefs.cleanup.days ?? 7}
                    min={1}
                    max={90}
                    aria-label="Days after the end"
                    onChange={setDays}
                    onBlur={() => {
                      if (days != null && days !== prefs.cleanup?.days) void save({ ...prefs, cleanup: { mode: 'after', days } });
                    }}
                  />
                  days after the end
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 py-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <div className="font-medium">Give the @Bingo player role</div>
                <div className="text-[12px] text-text-muted">The shared role every player in this event gets</div>
              </div>
              <Segmented
                ariaLabel="When to give the player role"
                disabled={saving}
                value={prefs.playerRole ?? 'default'}
                onChange={(v) => void save({ ...prefs, playerRole: v === 'default' ? undefined : v })}
                options={[
                  { value: 'default', label: `Default · ${timingLabel(clanRoles.playerRole ?? 'draft')}` },
                  { value: 'approve', label: 'When approved' },
                  { value: 'draft', label: 'After the draft' },
                  { value: 'never', label: 'Never' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <div className="font-medium">Take @Bingo player back when it ends</div>
                <div className="text-[12px] text-text-muted">So the role only marks people in an event that is running</div>
              </div>
              <Segmented
                ariaLabel="Remove the player role at the end"
                disabled={saving}
                value={prefs.removePlayerRoleAtEnd === undefined ? 'default' : prefs.removePlayerRoleAtEnd ? 'yes' : 'no'}
                onChange={(v) => void save({ ...prefs, removePlayerRoleAtEnd: v === 'default' ? undefined : v === 'yes' })}
                options={[
                  { value: 'default', label: `Default · ${clanRoles.removePlayerRoleAtEnd ? 'yes' : 'no'}` },
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
              />
            </div>
          </div>
          <p className="mt-3 text-[12px] text-text-muted">
            Now: team channels {roles.teamChannels ? 'on' : 'off'} · player role {timingLabel(roles.playerRole).toLowerCase()} ·
            cleanup {cleanupLabel(roles.cleanup).toLowerCase()}
            {roles.removePlayerRoleAtEnd ? ' · player role taken back at the end' : ''}.
          </p>
        </Section>
      </div>

      <aside className="min-w-0 flex-[1_1_300px] space-y-4 lg:sticky lg:top-6">
        <div className="space-y-4 rounded-2xl border border-card-border bg-card-bg p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">This event, at a glance</div>
          <div className="grid grid-cols-3 gap-3">
            <Stat n={paused ? 0 : onCount} label="posting" gold />
            <Stat n={paused ? DISCORD_POST_TYPES.length : DISCORD_POST_TYPES.length - onCount} label="muted" />
            <Stat n={paused ? 0 : pingCount} label="@pings" />
          </div>
          <p className="text-[13px] text-text-muted">
            {paused
              ? `Paused ${prefs.pausedUntil === 'indefinite' ? 'until you resume it' : `until ${new Date(prefs.pausedUntil!).toLocaleString()}`}. Posts due meanwhile are skipped, not saved for later.`
              : `${changed === 0 ? 'No changes from your clan defaults.' : `${changed} change${changed === 1 ? '' : 's'} from your clan defaults.`} Posts go to ${destLabel}${hasCohosts && prefs.cohosts !== false ? ' and to co-hosts' : ''}.`}
          </p>
          {paused ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save({ ...prefs, pausedUntil: null })}
              className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark hover:bg-gold/90 disabled:opacity-50"
            >
              Resume posting
            </button>
          ) : (
            <div className="space-y-2">
              <span className="text-[12px] text-text-muted">Pause until (leave empty to pause until you resume)</span>
              <DateTimePicker value={pauseUntil} onChange={setPauseUntil} placeholder="Until I resume it" ariaLabel="Pause until" />
              <button
                type="button"
                disabled={saving}
                onClick={() => void save({ ...prefs, pausedUntil: pauseUntil || 'indefinite' })}
                className="w-full rounded-lg border border-accent-red/50 bg-accent-red/10 px-4 py-2.5 text-sm font-semibold text-accent-red hover:bg-accent-red/20 disabled:opacity-50"
              >
                Pause all posts
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ n, label, gold }: { n: number; label: string; gold?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${gold ? 'text-gold' : ''}`}>{n}</div>
      <div className="text-[12px] text-text-muted">{label}</div>
    </div>
  );
}

function timingLabel(t: 'approve' | 'draft' | 'never'): string {
  return t === 'approve' ? 'When approved' : t === 'draft' ? 'After the draft' : 'Never';
}

function cleanupLabel(c: { mode: 'never' | 'end' | 'after'; days?: number }): string {
  return c.mode === 'never' ? 'Never' : c.mode === 'end' ? 'At the end' : `${c.days ?? 7} days after`;
}

const VERDICT: Record<PartnerReadiness['verdict'], { label: string; cls: string }> = {
  ready: { label: 'Ready', cls: 'border-accent-green/40 bg-accent-green/10 text-accent-green-light' },
  partial: { label: 'Something missing', cls: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300' },
  nothing: { label: 'Not using Discord', cls: 'border-card-border bg-brown-dark text-text-muted' },
};

/**
 * Each co-host's Discord for this board, as facts the host can act on (ask them to set a channel,
 * build their team channels). Every setting here is theirs to change, on their own co-hosted page.
 */
function PartnerList({ partners }: { partners: PartnerReadiness[] }) {
  return (
    <div className="space-y-2 border-t border-card-border-soft pt-4">
      <div className="text-[13px] font-semibold">Your co-hosts’ Discord</div>
      <p className="text-[12px] text-text-muted">What each partner’s own server does with this board. They change it on their side; this is so you know who to nudge.</p>
      <ul className="divide-y divide-card-border-soft rounded-lg border border-card-border-soft">
        {partners.map((p) => {
          const f = p.facts;
          const v = VERDICT[p.verdict];
          const bits = [
            `Posts: ${POSTS_LABEL[p.posts]}`,
            f.botConnected ? 'Bot connected' : 'No bot connected',
            `Player role ${f.playerRoleReady ? 'on' : 'off'}`,
            f.ownTeams > 0
              ? `Team channels ${f.teamsBuilt}/${f.ownTeams} built${f.autoTeamChannels ? ' (automatic)' : ''}`
              : null,
          ].filter(Boolean);
          return (
            <li key={p.clanId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
              <span className="font-medium">{p.name}</span>
              {p.pending ? (
                <span className="rounded-full border border-card-border px-2 py-0.5 text-[11px] text-text-muted">Hasn’t accepted yet</span>
              ) : (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${v.cls}`}>{v.label}</span>
              )}
              {!p.pending && <span className="w-full text-[12px] text-text-muted sm:w-auto">{bits.join(' · ')}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
