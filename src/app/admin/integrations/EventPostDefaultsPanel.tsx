'use client';

import { useEffect, useState } from 'react';

import Checkbox from '@/components/Checkbox';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import { clanFetch } from '@/lib/clanFetch';
import {
  DISCORD_POST_TYPES,
  POST_GROUPS,
  type ClanEventRoleDefaults,
  type DiscordPostType,
  type PingChoice,
} from '@/lib/discordPostPolicy';

interface Defaults {
  posts: Partial<Record<DiscordPostType, boolean>>;
  pings: Partial<Record<DiscordPostType, PingChoice>>;
  roles: ClanEventRoleDefaults;
}

const PING_OPTIONS = [
  { value: 'none', label: 'Nobody' },
  { value: 'members', label: '@Members' },
  { value: 'players', label: '@Bingo player' },
];

/**
 * What every event starts from: each event post on or off and who it pings, and when the player
 * role is given and team channels cleaned up. An event's own Discord tab can change any of it.
 */
export default function EventPostDefaultsPanel() {
  const [d, setD] = useState<Defaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await clanFetch('/api/admin/discord/event-defaults');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setD(data);
      else setError(data.error ?? 'Could not load the event defaults.');
    })();
  }, []);

  async function save(next: Defaults) {
    const before = d;
    setD(next);
    setSaving(true);
    setError(null);
    try {
      const res = await clanFetch('/api/admin/discord/event-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That did not save.');
      setD(data);
    } catch (e) {
      setD(before);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!d) return error ? <p className="text-sm text-accent-red">{error}</p> : <p className="text-sm text-text-muted">Loading…</p>;

  const cleanup = d.roles.cleanup ?? { mode: 'never' as const };

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-muted">
        Every event starts from these. An event can change any of them on its own Discord tab, and a Quiet or Silent
        event switches most of them off in one click.
      </p>
      {POST_GROUPS.map((g) => (
        <div key={g.key}>
          <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">{g.label}</div>
          <ul className="rounded-xl border border-card-border">
            {DISCORD_POST_TYPES.filter((t) => t.group === g.key).map((t) => {
              const on = d.posts[t.key] ?? true;
              const ping = d.pings[t.key] ?? (t.ping ? 'members' : 'none');
              return (
                <li key={t.key} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-card-border-soft px-4 py-2.5 last:border-b-0">
                  <div className="min-w-0 flex-[1_1_260px]">
                    <Checkbox
                      checked={on}
                      disabled={saving}
                      onChange={(v) => void save({ ...d, posts: { ...d.posts, [t.key]: v } })}
                      label={t.label}
                      description={t.help}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-text-muted">
                    Ping
                    <Select
                      className="w-44"
                      value={ping}
                      onChange={(v) => void save({ ...d, pings: { ...d.pings, [t.key]: v as PingChoice } })}
                      options={PING_OPTIONS}
                      ariaLabel={`Who ${t.label} pings`}
                      disabled={saving || !on}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="space-y-3 border-t border-card-border pt-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">Roles &amp; team channels</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-[1_1_240px] text-sm">Give the @Bingo player role</span>
          <Select
            className="w-56"
            value={d.roles.playerRole ?? 'draft'}
            onChange={(v) => void save({ ...d, roles: { ...d.roles, playerRole: v as ClanEventRoleDefaults['playerRole'] } })}
            options={[
              { value: 'approve', label: 'When a sign-up is approved' },
              { value: 'draft', label: 'When the draft finishes' },
              { value: 'never', label: 'Never' },
            ]}
            ariaLabel="When to give the player role"
            disabled={saving}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-[1_1_240px] text-sm">Clean up team channels &amp; roles</span>
          <Select
            className="w-56"
            value={cleanup.mode}
            onChange={(v) =>
              void save({
                ...d,
                roles: { ...d.roles, cleanup: v === 'after' ? { mode: 'after', days: cleanup.days ?? 7 } : { mode: v as 'never' | 'end' } },
              })
            }
            options={[
              { value: 'never', label: 'Never' },
              { value: 'end', label: 'When the event ends' },
              { value: 'after', label: 'Some days after the end' },
            ]}
            ariaLabel="Cleanup"
            disabled={saving}
          />
          {cleanup.mode === 'after' && (
            <span className="flex items-center gap-2 text-[12px] text-text-muted">
              <NumberInput
                className="w-20"
                value={days ?? cleanup.days ?? 7}
                min={1}
                max={90}
                aria-label="Days after the end"
                onChange={setDays}
                onBlur={() => {
                  if (days != null && days !== cleanup.days) void save({ ...d, roles: { ...d.roles, cleanup: { mode: 'after', days } } });
                }}
              />
              days
            </span>
          )}
        </div>
        <Checkbox
          checked={d.roles.removePlayerRoleAtEnd ?? false}
          disabled={saving}
          onChange={(v) => void save({ ...d, roles: { ...d.roles, removePlayerRoleAtEnd: v } })}
          label="Take the @Bingo player role back when an event ends"
          description="So the role only marks people in an event that is running"
        />
        <p className="text-[12px] text-text-muted">
          Cleanup only ever touches events that end after you turn it on. Roles your clan already had are never deleted.
        </p>
      </div>
      {error && <p className="text-[13px] text-accent-red">{error}</p>}
    </div>
  );
}
