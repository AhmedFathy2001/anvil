'use client';

import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import { useDialog } from '@/components/Confirm';
import type { AdminStatus } from '@/lib/eventDiscord';

type Layout = AdminStatus['layout'];

const LAYOUTS: { value: Layout; label: string; hint: string }[] = [
  { value: 'own', label: 'Host’s own server', hint: 'The classic setup: team roles and channels in the host’s server.' },
  {
    value: 'joint',
    label: 'Joint event server',
    hint: 'A shared server with one role per team and shared text + voice. Each clan’s private planning channels stay in its own server, so neither side can see the other’s plan.',
  },
  {
    value: 'single',
    label: 'One server for everything',
    hint: 'A new server or either clan’s. It holds the team roles, shared channels and private planning channels. Its admins can see every team’s planning.',
  },
];

const MEMBER_STATUS: Record<string, { label: string; cls: string }> = {
  joined: { label: 'in server', cls: 'text-accent-green-light' },
  pending: { label: 'not joined yet', cls: 'text-text-muted' },
  'no-discord': { label: 'no Discord linked', cls: 'text-accent-red' },
};

/**
 * The event Discord server for a co-hosted event (lib/eventDiscord). Rendered for the host on the
 * Teams tab and for a co-host's admins on the event's Discord page at their own address, where every
 * call goes to their own clan (each clan only ever drives its own bot).
 */
export default function EventDiscordServerPanel({ eventId }: { eventId: number }) {
  const { confirm } = useDialog();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [layout, setLayout] = useState<Layout>('own');
  const [guildId, setGuildId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await clanFetch(`/api/admin/events/${eventId}/event-discord`);
    if (!res.ok) return;
    const data = (await res.json()) as AdminStatus;
    setStatus(data);
    setLayout(data.layout);
    if (data.server) setGuildId(data.server.id);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: string, extra: Record<string, unknown> = {}, okText?: string) {
    if (action === 'teardown-event-server' || action === 'teardown-planning') {
      const ok = await confirm({
        title: action === 'teardown-event-server' ? 'Delete the event server’s roles and channels?' : 'Delete your planning channels?',
        body: 'The channels, their message history and the team roles will be deleted from Discord. You can rebuild them, but the history is gone.',
        confirmLabel: 'Delete',
      });
      if (!ok) return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/event-discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? 'Something went wrong');
      if (data?.status) {
        setStatus(data.status);
        setLayout(data.status.layout);
      }
      setMessage({ kind: 'ok', text: okText ?? summarise(action, data?.report) });
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!status) return null;
  if (!status.cohosted && status.layout === 'own') return null;

  const isHost = status.role === 'host';
  const configurable = !status.provisioned && (isHost || status.boundByThisClan || !status.server);
  const ownTeams = status.teams.filter((t) => t.planning !== null);
  const counts = {
    joined: status.members.filter((m) => m.status === 'joined').length,
    pending: status.members.filter((m) => m.status === 'pending').length,
    noDiscord: status.members.filter((m) => m.status === 'no-discord').length,
    dmFailed: status.members.filter((m) => m.status === 'pending' && m.dmStatus === 'failed').length,
  };

  return (
    <section className="mb-6 rounded-2xl border border-card-border bg-card-bg">
      <div className="flex items-center gap-2.5 border-b border-card-border px-5 py-3.5">
        <span className="molten h-5 w-1 shrink-0 rounded-sm" />
        <h2 className="text-[15px] font-semibold">Event Discord server</h2>
        <span className="ml-auto text-[12px] text-text-muted">Where this event’s teams talk.</span>
      </div>

      <div className="space-y-5 px-5 py-4 text-[13px]">
        {/* Layout */}
        <div className="space-y-2">
          {LAYOUTS.filter((l) => l.value !== 'own' || isHost).map((l) => (
            <label key={l.value} className={`flex gap-2.5 rounded-lg border p-3 ${layout === l.value ? 'border-gold/60 bg-gold/5' : 'border-card-border'} ${configurable ? 'cursor-pointer' : 'opacity-70'}`}>
              <input
                type="radio"
                name={`layout-${eventId}`}
                checked={layout === l.value}
                disabled={!configurable}
                onChange={() => setLayout(l.value)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">{l.label}</span>
                <span className="block text-[12px] text-text-muted">{l.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {layout !== 'own' && (
          <div className="space-y-2">
            <label className="block text-[12px] text-text-muted">
              Server ID. You must own the server or have Administrator / Manage Server in it, and your clan’s Anvil bot must already be in it with Manage Roles, Manage Channels and Create Invite.
            </label>
            <div className="flex gap-2">
              <input
                value={guildId}
                onChange={(e) => setGuildId(e.target.value.trim())}
                disabled={!configurable}
                placeholder="123456789012345678"
                className="flex-1 rounded-md border border-card-border bg-transparent px-3 py-1.5 font-mono text-[13px]"
              />
            </div>
          </div>
        )}

        {configurable && (layout !== status.layout || (layout !== 'own' && guildId !== (status.server?.id ?? ''))) && (
          <button
            onClick={() => run('configure', { layout, guildId }, 'Saved.')}
            disabled={!!busy}
            className="rounded-md bg-gold px-3 py-1.5 text-[13px] font-semibold text-black disabled:opacity-50"
          >
            {busy === 'configure' ? 'Checking with Discord…' : 'Save setup'}
          </button>
        )}

        {status.layout !== 'own' && status.server && (
          <div className="flex items-center gap-3 rounded-lg border border-card-border p-3">
            {status.server.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={status.server.iconUrl} alt="" className="h-9 w-9 rounded-full" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-card-border" />
            )}
            <div>
              <div className="font-semibold">{status.server.name}</div>
              <div className="text-[12px] text-text-muted">
                {status.layout === 'joint' ? 'Joint event server' : 'Single server'} · shared text {status.sharedText ? '✓' : '—'} · shared voice {status.sharedVoice ? '✓' : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Event server actions */}
        {status.layout !== 'own' && status.server && status.canManageEventServer && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => run('setup-all')} disabled={!!busy} className="rounded-md bg-gold px-3 py-1.5 text-[13px] font-semibold text-black disabled:opacity-50">
                {busy === 'setup-all' ? 'Working…' : status.provisioned ? 'Update roles + bring players in' : 'Create roles + channels and bring players in'}
              </button>
              {status.provisioned && (
                <button onClick={() => run('sync-members')} disabled={!!busy} className="rounded-md border border-card-border px-3 py-1.5 text-[13px] disabled:opacity-50">
                  {busy === 'sync-members' ? 'Working…' : 'Re-check players'}
                </button>
              )}
              {status.provisioned && (
                <button onClick={() => run('teardown-event-server')} disabled={!!busy} className="rounded-md border border-accent-red/50 px-3 py-1.5 text-[13px] text-accent-red disabled:opacity-50">
                  Delete event server roles + channels
                </button>
              )}
            </div>
            <p className="text-[12px] text-text-muted">
              Players who allowed auto-join are added straight away with their team role. Everyone else gets one DM from the bot pointing to their Anvil event page, which shows their invite and a verification code. The DM never contains an invite link.
              {!status.autoJoinStoresGrants &&
                ' DISCORD_TOKEN_KEY isn’t set here, so players are only added automatically at the moment they press “Allow” on their page, not on later re-checks.'}
            </p>
          </div>
        )}

        {/* Own planning (joint) */}
        {status.layout === 'joint' && (
          <div className="space-y-2 rounded-lg border border-card-border p-3">
            <div className="font-semibold">Your private planning channels</div>
            <p className="text-[12px] text-text-muted">
              A private team role plus text and voice channels, created in <em>your own</em> clan server by your own bot. Only your team members get the role. The other clan never sees these channels.
              {status.ownTeamSyncEnabled ? ' They are also created automatically when the rosters are final.' : ''}
            </p>
            {!status.ownServerConnected ? (
              <p className="text-[12px] text-accent-red">Connect your clan’s bot and server under Integrations first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => run('planning')} disabled={!!busy} className="rounded-md border border-card-border px-3 py-1.5 text-[13px] disabled:opacity-50">
                  {busy === 'planning' ? 'Working…' : 'Create / update my planning channels'}
                </button>
                <button onClick={() => run('teardown-planning')} disabled={!!busy} className="rounded-md border border-accent-red/50 px-3 py-1.5 text-[13px] text-accent-red disabled:opacity-50">
                  Delete my planning channels
                </button>
              </div>
            )}
            {ownTeams.length > 0 && (
              <ul className="text-[12px] text-text-muted">
                {ownTeams.map((t) => (
                  <li key={t.id}>
                    {t.name}: event role {t.eventRole ? '✓' : '—'} · planning {t.planning ? '✓' : '—'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* A co-host's own contestant role, in its own server */}
        {status.cohostRole && (
          <div className="space-y-2 rounded-lg border border-card-border p-3">
            <div className="font-semibold">Your contestant role</div>
            <p className="text-[12px] text-text-muted">
              Gives your clan’s approved sign-ups for this event the contestant role in your own server, so they can see your bingo channels. Only your own members, only your own role.
            </p>
            {status.cohostRole.ready ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => run('cohost-role-assign', {}, 'Contestant role given to your approved sign-ups.')} disabled={!!busy} className="rounded-md border border-card-border px-3 py-1.5 text-[13px] disabled:opacity-50">
                  {busy === 'cohost-role-assign' ? 'Working…' : 'Give the contestant role'}
                </button>
                <button onClick={() => run('cohost-role-remove', {}, 'Contestant role taken back off.')} disabled={!!busy} className="rounded-md border border-accent-red/50 px-3 py-1.5 text-[13px] text-accent-red disabled:opacity-50">
                  Take it back off
                </button>
              </div>
            ) : (
              <p className="text-[12px] text-accent-red">
                Turn on co-hosted event role tools and pick your contestant role under Integrations → Discord team channels first.
              </p>
            )}
          </div>
        )}

        {/* Members */}
        {status.layout !== 'own' && status.members.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold">
              Players · {counts.joined} in · {counts.pending} not yet
              {counts.noDiscord > 0 && ` · ${counts.noDiscord} without Discord`}
            </div>
            {counts.dmFailed > 0 && (
              <p className="text-[12px] text-accent-red">
                {counts.dmFailed} couldn’t be DMed (they share no server with the bot, or have DMs off). Ask their captain to send them to their event page.
              </p>
            )}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-card-border">
              <table className="w-full text-[12px]">
                <tbody>
                  {status.members.map((m, i) => (
                    <tr key={i} className="border-b border-card-border last:border-0">
                      <td className="px-3 py-1.5">{m.name}</td>
                      <td className="px-3 py-1.5 text-text-muted">{m.teamName}</td>
                      <td className={`px-3 py-1.5 ${MEMBER_STATUS[m.status].cls}`}>
                        {MEMBER_STATUS[m.status].label}
                        {m.method === 'auto' && ' (auto)'}
                        {m.status === 'pending' && m.dmStatus === 'failed' && ' · DM failed'}
                        {m.status === 'pending' && m.dmStatus === 'sent' && ' · DM sent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {message && (
          <p className={`text-[12.5px] ${message.kind === 'ok' ? 'text-accent-green-light' : 'text-accent-red'}`}>{message.text}</p>
        )}
      </div>
    </section>
  );
}

function summarise(action: string, report: unknown): string {
  type Counts = Partial<Record<'joined' | 'autoJoined' | 'pending' | 'dmSent' | 'dmFailed' | 'noDiscord' | 'membersAssigned' | 'membersNotInServer', number>>;
  const r = (report ?? {}) as Counts & { members?: Counts };
  if (action === 'setup-all') {
    const m = r.members ?? {};
    return `Done. ${m.joined ?? 0} in the server (${m.autoJoined ?? 0} added automatically), ${m.pending ?? 0} still to join, ${m.dmSent ?? 0} DMed${m.dmFailed ? `, ${m.dmFailed} couldn’t be DMed` : ''}${m.noDiscord ? `, ${m.noDiscord} have no Discord linked` : ''}.`;
  }
  if (action === 'sync-members') {
    return `${r.joined ?? 0} in the server, ${r.pending ?? 0} still to join${r.dmSent ? `, ${r.dmSent} newly DMed` : ''}.`;
  }
  if (action === 'planning') {
    return `Planning channels ready. ${r.membersAssigned ?? 0} teammates given the role${r.membersNotInServer ? `, ${r.membersNotInServer} aren’t in your server` : ''}.`;
  }
  return 'Done.';
}
