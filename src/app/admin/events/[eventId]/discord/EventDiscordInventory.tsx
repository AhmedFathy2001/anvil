'use client';

import { useCallback, useEffect, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { useDialog } from '@/components/Confirm';
import { clanFetch } from '@/lib/clanFetch';
import {
  missingCount,
  storedCount,
  type EventDiscordInventory as Inventory,
  type InventoryItem,
  type InventoryStatus,
  type PlayerRoleStatus,
} from '@/lib/eventDiscordInventory';
import { Section } from './EventDiscordClient';

type Part = 'role' | 'text' | 'voice';

const STATUS: Record<InventoryStatus, { label: string; cls: string }> = {
  exists: { label: 'In Discord', cls: 'border-accent-green/40 bg-accent-green/10 text-accent-green-light' },
  missing: { label: 'Deleted in Discord', cls: 'border-accent-red/40 bg-accent-red/10 text-accent-red' },
  'no-access': { label: 'Bot can’t see it', cls: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-300' },
  unknown: { label: 'Couldn’t check', cls: 'border-card-border bg-brown-dark text-text-muted' },
  none: { label: 'Not made', cls: 'border-card-border bg-brown-dark text-text-muted' },
};

const PLAYER_STATUS: Record<PlayerRoleStatus, { label: string; cls: string }> = {
  exists: STATUS.exists,
  missing: STATUS.missing,
  unknown: STATUS.unknown,
  'not-set': { label: 'Not set', cls: STATUS.none.cls },
  unsafe: { label: 'Has admin powers — not handed out', cls: STATUS['no-access'].cls },
};

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>;
}

const PART_LABEL: Record<Part, string> = { role: 'Role', text: 'Text channel', voice: 'Voice channel' };

/**
 * "In your Discord now": what Anvil made in the clan's server for this event — category, the
 * clan's player role, each team's role and channels — checked live, with the fixes next to it.
 * Only what Anvil made is listed; anything else in the server is the clan's and never touched.
 */
export default function EventDiscordInventory({ eventId }: { eventId: number }) {
  const { confirm, notify } = useDialog();
  const [inv, setInv] = useState<Inventory | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const base = `/api/admin/events/${eventId}/discord/inventory`;

  const load = useCallback(async () => {
    const res = await clanFetch(base);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setInv(data.inventory);
      setCanManage(!!data.canManage);
      setError(null);
    } else setError(data.error ?? 'Could not check Discord.');
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setError(null);
    try {
      const res = await clanFetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'That did not work.');
        await load();
        return;
      }
      if (data.inventory) setInv(data.inventory);
      if (data.message) notify(data.message);
    } finally {
      setBusy(null);
    }
  }

  async function createMissing() {
    if (!inv) return;
    const ok = await confirm({
      title: 'Create what’s missing?',
      body: 'Anvil makes the team roles and private channels this event should have but doesn’t (including ones deleted by hand), and the player role if none is set. Nothing that exists is touched.',
      confirmLabel: 'Create',
      tone: 'gold',
    });
    if (ok) await run('create', { action: 'create-missing' });
  }

  async function resync() {
    const ok = await confirm({
      title: 'Re-sync roles?',
      body: 'Gives every player on a team their team role, and the player role per this event’s setting. Nobody loses a role.',
      confirmLabel: 'Re-sync',
      tone: 'gold',
    });
    if (ok) await run('resync', { action: 'resync-roles' });
  }

  async function deleteAll() {
    const ok = await confirm({
      title: 'Delete everything Anvil made for this event?',
      body: 'Deletes every team role, team text and voice channel, and the event category that Anvil created. Messages in those channels are gone for good. The shared player role and anything your clan made itself stay.',
      confirmLabel: 'Delete all',
      tone: 'danger',
    });
    if (ok) await run('delete-all', { action: 'delete-all' });
  }

  async function deleteOne(teamName: string, part: Part, teamId: number, item: InventoryItem) {
    const what = part === 'role' ? `the ${teamName} role` : `${item.name ? `#${item.name}` : `the ${teamName} ${PART_LABEL[part].toLowerCase()}`}`;
    const ok = await confirm({
      title: `Delete ${what}?`,
      body:
        part === 'role'
          ? 'Players lose this role, and with it access to the team’s channels. “Create missing” can make a new one.'
          : 'The channel and its messages are gone for good. “Create missing” can make a new, empty one.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) await run(`del-${teamId}-${part}`, { action: 'delete-one', teamId, part });
  }

  const title = 'In your Discord now';
  if (!inv) {
    return (
      <Section title={title}>
        <p className={`text-[13px] ${error ? 'text-accent-red' : 'text-text-muted'}`}>{error ?? 'Checking Discord…'}</p>
      </Section>
    );
  }

  if (!inv.connected) {
    return (
      <Section title={title}>
        <p className="text-[13px] text-text-muted">
          Connect your Discord bot under{' '}
          <ClanLink href="/admin/integrations" className="text-gold hover:underline">
            Integrations
          </ClanLink>{' '}
          to see and manage this event’s roles and channels.
        </p>
      </Section>
    );
  }

  const eventServer = inv.layout !== 'own';
  const toCreate = eventServer ? 0 : missingCount(inv);
  const stored = storedCount(inv);
  const anyBusy = busy !== null;
  const btn = 'min-h-9 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50';

  const actions = canManage ? (
    <div className="flex flex-wrap gap-2">
      {!eventServer && (
        <>
          <button type="button" disabled={anyBusy || toCreate === 0} onClick={createMissing} className={`${btn} bg-gold text-brown-dark hover:bg-gold/90`}>
            {busy === 'create' ? 'Creating…' : `Create missing${toCreate ? ` (${toCreate})` : ''}`}
          </button>
          <button type="button" disabled={anyBusy} onClick={resync} className={`${btn} border border-card-border text-foreground hover:border-gold/40`}>
            {busy === 'resync' ? 'Syncing…' : 'Re-sync roles'}
          </button>
        </>
      )}
      <button
        type="button"
        disabled={anyBusy || stored === 0}
        onClick={deleteAll}
        className={`${btn} border border-accent-red/50 bg-accent-red/10 text-accent-red hover:bg-accent-red/20`}
      >
        {busy === 'delete-all' ? 'Deleting…' : 'Delete all Anvil-made'}
      </button>
    </div>
  ) : null;

  return (
    <Section title={title} aside={actions}>
      <div className="space-y-4 text-[13px]">
        {error && <p className="text-accent-red">{error}</p>}
        {eventServer && (
          <p className="text-text-muted">
            This event runs its teams in a separate event server — manage that in the Event Discord server panel below. Anything
            listed here was made in your own server earlier and can be cleaned up.
          </p>
        )}
        {!eventServer && !inv.teamChannels && (
          <p className="text-text-muted">
            Team channels are off for this event (see “Roles &amp; team channels” below), so Anvil won’t make any. Anything listed
            here was made earlier and can still be deleted.
          </p>
        )}

        <ul className="divide-y divide-card-border-soft rounded-lg border border-card-border-soft">
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <span className="min-w-0 flex-[1_1_200px] font-medium">
              Player role{inv.playerRole.name ? <span className="text-text-muted"> · @{inv.playerRole.name}</span> : null}
            </span>
            <Pill {...PLAYER_STATUS[inv.playerRole.status]} />
            <span className="w-full text-[12px] text-text-muted">
              Your clan’s shared role for everyone playing{inv.playerRoleTiming === 'never' ? ' — this event doesn’t hand it out' : ''}. Set in{' '}
              <ClanLink href="/admin/integrations" className="text-gold hover:underline">
                Integrations
              </ClanLink>
              ; never deleted from here.
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <span className="min-w-0 flex-[1_1_200px] font-medium">
              Event category{inv.category.name ? <span className="text-text-muted"> · {inv.category.name}</span> : null}
            </span>
            <Pill {...STATUS[inv.category.status]} />
          </li>
        </ul>

        {inv.teams.length === 0 ? (
          <p className="text-text-muted">No teams yet.</p>
        ) : (
          <ul className="space-y-2">
            {inv.teams.map((t) => (
              <li key={t.teamId} className="rounded-lg border border-card-border-soft">
                <div className="flex flex-wrap items-center gap-2 border-b border-card-border-soft px-3 py-2">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color ?? 'var(--color-gold)' }} />
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-[12px] text-text-muted">
                    {t.players} player{t.players === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="divide-y divide-card-border-soft">
                  {(['role', 'text', 'voice'] as const).map((part) => {
                    const item = t[part];
                    const shown = item.name ? (part === 'role' ? `@${item.name}` : part === 'text' ? `#${item.name}` : item.name) : null;
                    return (
                      <li key={part} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <span className="min-w-0 flex-[1_1_200px]">
                          {PART_LABEL[part]}
                          {shown && <span className="text-text-muted"> · {shown}</span>}
                        </span>
                        <Pill {...STATUS[item.status]} />
                        {canManage && item.id && (
                          <button
                            type="button"
                            disabled={anyBusy}
                            onClick={() => void deleteOne(t.name, part, t.teamId, item)}
                            className="min-h-8 rounded-lg border border-card-border px-2.5 text-[12px] text-text-muted hover:border-accent-red/50 hover:text-accent-red disabled:opacity-50"
                          >
                            {busy === `del-${t.teamId}-${part}` ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-text-muted">
          Only what Anvil made for this event is listed or deleted. “Bot can’t see it” usually means a private channel made before the bot
          gave itself access — delete it by hand in Discord, then use “Create missing”.
        </p>
      </div>
    </Section>
  );
}
