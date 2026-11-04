'use client';

import Select from '@/components/Select';
import ClanLink from '@/components/ClanLink';
import type { EntryGates, GateOptions, GateRule, SubTier } from '@/lib/entryGates';

type Choice = 'followers' | 'subs' | 'role' | 'boosters';

/**
 * "Who can join?" for a creator-space event (lib/entryGates). Anyone, or any mix of: the host's
 * Twitch followers, their subscribers (tier), a role in their Discord server, its boosters. Any one
 * is enough — said right under the choices.
 *
 * Controlled: `value` null means Anyone. A choice the host cannot use yet is shown with the one
 * thing to do about it (connect Twitch / connect Discord); Twitch choices are hidden entirely when the
 * server has no Twitch app configured.
 */
export default function EntryGatePicker({
  value,
  onChange,
  options,
}: {
  value: EntryGates | null;
  onChange: (next: EntryGates | null) => void;
  options: GateOptions;
}) {
  const rules = value?.anyOf ?? [];
  const has = (k: GateRule['kind']) => rules.some((r) => r.kind === k);
  const sub = rules.find((r): r is Extract<GateRule, { kind: 'twitch-sub' }> => r.kind === 'twitch-sub');
  const role = rules.find((r): r is Extract<GateRule, { kind: 'discord-role' }> => r.kind === 'discord-role');

  const tw = options.twitch;
  const twitchReady = tw.configured && !!tw.channel && !tw.channel.broken;
  const subsReady = twitchReady && !!tw.channel?.canHaveSubs;
  const discordReady = options.discord.connected;
  const roleReady = discordReady && options.discord.roles.length > 0;

  function emit(next: GateRule[]) {
    onChange(next.length > 0 ? { anyOf: next } : null);
  }

  function toggle(c: Choice) {
    const without = (k: GateRule['kind']) => rules.filter((r) => r.kind !== k);
    switch (c) {
      case 'followers':
        return emit(has('twitch-follow') ? without('twitch-follow') : [...rules, { kind: 'twitch-follow' }]);
      case 'subs':
        return emit(sub ? without('twitch-sub') : [...rules, { kind: 'twitch-sub', tier: 1 }]);
      case 'role': {
        if (role) return emit(without('discord-role'));
        const first = options.discord.roles[0];
        return first ? emit([...rules, { kind: 'discord-role', roleId: first.id, roleName: first.name }]) : undefined;
      }
      case 'boosters':
        return emit(has('discord-booster') ? without('discord-booster') : [...rules, { kind: 'discord-booster' }]);
    }
  }

  // A full navigation to the (platform-level, unprefixed) OAuth start, coming back to this page.
  const connectTwitch = tw.connectUrl
    ? () => window.location.assign(`${tw.connectUrl}&return=${encodeURIComponent(window.location.pathname)}`)
    : null;

  const chips: { key: Choice; label: string; on: boolean; ready: boolean; show: boolean }[] = [
    { key: 'followers', label: 'Twitch followers', on: has('twitch-follow'), ready: twitchReady, show: tw.configured },
    { key: 'subs', label: 'Twitch subs', on: !!sub, ready: subsReady, show: tw.configured },
    { key: 'role', label: 'Discord role', on: !!role, ready: roleReady, show: true },
    { key: 'boosters', label: 'Server boosters', on: has('discord-booster'), ready: discordReady, show: true },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip on={rules.length === 0} onClick={() => onChange(null)}>
          Anyone
        </Chip>
        {chips
          .filter((c) => c.show)
          .map((c) => (
            <Chip key={c.key} on={c.on} disabled={!c.ready && !c.on} onClick={() => toggle(c.key)}>
              {c.label}
            </Chip>
          ))}
      </div>

      {rules.length > 1 && <p className="mt-2 text-[12.5px] text-text-muted">Any one of these is enough.</p>}

      {(sub || role) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {sub && (
            <label className="flex items-center gap-2 text-[13px]">
              <span className="text-text-muted">Subs at</span>
              <Select
                value={String(sub.tier)}
                onChange={(v) =>
                  emit(rules.map((r) => (r.kind === 'twitch-sub' ? { kind: 'twitch-sub', tier: Number(v) as SubTier } : r)))
                }
                ariaLabel="Lowest sub tier"
                className="min-w-[8rem]"
                options={[
                  { value: '1', label: 'Tier 1 or higher' },
                  { value: '2', label: 'Tier 2 or higher' },
                  { value: '3', label: 'Tier 3' },
                ]}
              />
            </label>
          )}
          {role && (
            <label className="flex items-center gap-2 text-[13px]">
              <span className="text-text-muted">Role</span>
              <Select
                value={role.roleId}
                onChange={(v) => {
                  const picked = options.discord.roles.find((x) => x.id === v);
                  if (!picked) return;
                  emit(rules.map((r) => (r.kind === 'discord-role' ? { kind: 'discord-role', roleId: picked.id, roleName: picked.name } : r)));
                }}
                ariaLabel="Discord role"
                className="min-w-[10rem]"
                options={options.discord.roles.map((x) => ({ value: x.id, label: `@${x.name}` }))}
              />
            </label>
          )}
        </div>
      )}

      {/* The one thing to do, when a choice is greyed out. */}
      <div className="mt-2 space-y-1 text-[12.5px] text-text-muted">
        {tw.configured && !twitchReady && connectTwitch && (
          <p>
            {tw.channel?.broken ? 'Twitch stopped accepting your connection. ' : 'To use Twitch, '}
            <button type="button" onClick={connectTwitch} className="text-gold hover:underline">
              {tw.channel?.broken ? 'connect it again' : 'connect your Twitch channel'}
            </button>
            .
          </p>
        )}
        {twitchReady && !subsReady && <p>Sub-only needs a Twitch affiliate or partner channel.</p>}
        {!discordReady && (
          <p>
            For Discord choices,{' '}
            <ClanLink href="/admin/integrations" className="text-gold hover:underline">
              connect your Discord server
            </ClanLink>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? 'border-gold bg-gold/10 text-gold' : 'border-card-border bg-card-bg hover:border-gold/40'
      }`}
    >
      {children}
    </button>
  );
}
