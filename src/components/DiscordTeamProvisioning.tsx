'use client';

import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';

interface TeamState {
  id: number;
  name: string;
  hasRole: boolean;
  hasTextChannel: boolean;
  hasVoiceChannel: boolean;
}

interface StatusData {
  enabled: boolean;
  categoryId: string | null;
  draftStatus: string;
  bingoRoleConfigured: boolean;
  captainRoleConfigured: boolean;
  approvedSignups: number;
  teams: TeamState[];
  fullyProvisioned: boolean;
}

// Admin panel for an event's Teams tab: create per-team Discord roles + locked channels,
// and assign contestant roles once the draft is done. Hidden entirely when the feature is
// disabled — UNLESS `showWhenDisabled` is set, which instead surfaces a short "it's off, enable
// it here" hint (used in the post-draft view so an admin isn't left staring at nothing).
export default function DiscordTeamProvisioning({
  eventId,
  showWhenDisabled = false,
}: {
  eventId: number;
  showWhenDisabled?: boolean;
}) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Teardown gets a real confirmation dialog (listing exactly what will be deleted +
  // type-to-confirm) instead of a bare confirm() — it's an irreversible Discord-wide delete.
  const [teardownOpen, setTeardownOpen] = useState(false);
  const [teardownConfirmText, setTeardownConfirmText] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await clanFetch(`/api/events/${eventId}/discord`);
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runAction(action: 'sync-all' | 'provision' | 'assign-rosters' | 'assign-bingo-role' | 'unassign-shared-roles' | 'teardown') {
    if (
      action === 'unassign-shared-roles' &&
      !confirm('Take the shared bingo role off everyone in this event, and the captain role off its captains? The roles themselves are kept (they’re reused across events). Heads up: these roles are shared, so anyone also in another active event loses them there too.')
    ) {
      return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.report || {};
        let text = 'Done.';
        let type: 'success' | 'error' = 'success';
        if (action === 'sync-all') {
          const teamsN = r.provision?.teams?.length ?? 0;
          const assignedN = r.assign?.assigned ?? 0;
          const skippedN = r.assign?.skipped ?? 0;
          text = `Set up ${teamsN} team channel(s) and assigned roles to ${assignedN} contestant(s)${skippedN ? `, ${skippedN} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'provision') {
          text = `Provisioned ${r.teams?.length ?? 0} team(s)${r.captainsAssigned ? `, ${r.captainsAssigned} captain(s) assigned` : ''}.`;
        } else if (action === 'assign-rosters') {
          text = `Assigned roles to ${r.assigned ?? 0} contestant(s)${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'assign-bingo-role') {
          text = `Gave the bingo role to ${r.assigned ?? 0} approved contestant(s)${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'unassign-shared-roles') {
          text = `Removed the bingo role from ${r.bingoRemoved ?? 0} member(s) and the captain role from ${r.captainRemoved ?? 0}.`;
        } else if (action === 'teardown') {
          const failedN = (r.rolesFailed ?? 0) + (r.channelsFailed ?? 0) + (r.categoryFailed ? 1 : 0);
          text = `Removed ${r.rolesDeleted ?? 0} role(s) and ${r.channelsDeleted ?? 0} channel(s)${r.categoryDeleted ? ', plus the event category' : ''}.`;
          if (failedN > 0) {
            type = 'error';
            text += ` Discord refused ${failedN} delete(s) — those are kept so a re-run can retry them.${r.failDetail ? ` ${r.failDetail}` : ''}`;
          }
        }
        setMessage({ type, text });
        await loadStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Action failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Action failed' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;

  // Feature off for this clan. Normally render nothing, but in contexts that pass
  // showWhenDisabled (the post-draft view) surface a hint so the admin knows the option exists
  // and where to turn it on — otherwise they just see nothing and assume it's broken.
  if (!status || !status.enabled) {
    if (!showWhenDisabled) return null;
    return (
      <div className="pt-8 border-t border-card-border">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <span className="w-1 h-5 bg-indigo-400 rounded-full" />
          Discord Channels &amp; Roles
        </h2>
        <p className="text-xs text-text-muted">
          Auto-creating a private channel per team and handing out contestant roles is turned off.
          Enable it under{' '}
          <ClanLink href="/admin/integrations" className="text-gold hover:underline">
            Advanced settings → Discord team channels
          </ClanLink>{' '}
          (needs the bot token + server ID). Once on, this is where you provision channels and assign
          everyone — automatically when the draft ends, or with a button here.
        </p>
      </div>
    );
  }

  const draftComplete = status.draftStatus === 'completed';
  const anyProvisioned = status.teams.some((t) => t.hasRole || t.hasTextChannel || t.hasVoiceChannel);

  return (
    <details className="pt-8 border-t border-card-border group" open={anyProvisioned}>
      <summary className="cursor-pointer select-none list-none flex items-center gap-2 mb-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-400 rounded-full" />
          Discord Channels &amp; Roles
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-text-muted px-1.5 py-0.5 rounded border border-card-border">
          Optional
        </span>
        <span className="ml-auto text-text-muted transition-transform group-open:rotate-90">▸</span>
      </summary>
      <p className="text-xs text-text-muted mb-4">
        Create a private voice + text channel per team and assign Discord roles. You can provision
        roles &amp; channels now; contestant roles are assigned automatically when the draft completes
        (or with the button below). Give every approved sign-up the shared bingo role at any time — even
        before the draft — so they can see the bingo channel and get pinged with the rules.
      </p>

      {status.teams.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {status.teams.map((t) => (
            <div key={t.id} className="flex items-center justify-between border border-card-border rounded-lg p-2 bg-card-bg text-sm">
              <span className="font-medium">{t.name}</span>
              <div className="flex items-center gap-1.5">
                <Badge label="Role" on={t.hasRole} />
                <Badge label="Text" on={t.hasTextChannel} />
                <Badge label="Voice" on={t.hasVoiceChannel} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {/* One-click primary action once the draft is done: create channels/roles AND assign
            everyone. This is what runs automatically on draft completion; the button lets an
            admin (re-)run it. */}
        {draftComplete && (
          <button
            onClick={() => runAction('sync-all')}
            disabled={!!busy || status.teams.length === 0}
            title="Create every team's channel + role and assign each contestant their roles — in one click"
            className="text-sm font-semibold bg-accent-green/25 text-accent-green-light border border-accent-green/50 px-4 py-2 rounded-lg hover:bg-accent-green/35 transition-colors disabled:opacity-50"
          >
            {busy === 'sync-all'
              ? 'Setting up…'
              : status.fullyProvisioned
                ? 'Re-sync channels & assign everyone'
                : 'Set up team channels & assign everyone'}
          </button>
        )}

        <button
          onClick={() => runAction('provision')}
          disabled={!!busy || status.teams.length === 0}
          className="text-sm font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {busy === 'provision' ? 'Provisioning…' : status.fullyProvisioned ? 'Re-sync Roles & Channels' : 'Create Roles & Channels'}
        </button>

        <button
          onClick={() => runAction('assign-bingo-role')}
          disabled={!!busy || !status.bingoRoleConfigured || status.approvedSignups === 0}
          title={
            !status.bingoRoleConfigured
              ? 'Set a bingo role ID under Integrations → Discord team channels first'
              : status.approvedSignups === 0
                ? 'No approved sign-ups yet'
                : `Give the bingo role to all ${status.approvedSignups} approved contestant(s)`
          }
          className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {busy === 'assign-bingo-role'
            ? 'Assigning…'
            : `Give bingo role to approved${status.approvedSignups ? ` (${status.approvedSignups})` : ''}`}
        </button>

        <button
          onClick={() => runAction('assign-rosters')}
          disabled={!!busy || !draftComplete || !status.fullyProvisioned}
          title={!draftComplete ? 'Available once the draft is completed' : !status.fullyProvisioned ? 'Provision roles & channels first' : undefined}
          className="text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
        >
          {busy === 'assign-rosters' ? 'Assigning…' : 'Assign Contestant Roles'}
        </button>

        {(status.bingoRoleConfigured || status.captainRoleConfigured) && (
          <button
            onClick={() => runAction('unassign-shared-roles')}
            disabled={!!busy}
            title="Take the shared bingo & captain roles off this event’s members (the roles themselves are kept)"
            className="text-sm font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 px-4 py-2 rounded-lg hover:bg-amber-400/20 transition-colors disabled:opacity-50"
          >
            {busy === 'unassign-shared-roles' ? 'Removing…' : 'Remove bingo & captain roles'}
          </button>
        )}

        {anyProvisioned && (
          <button
            onClick={() => {
              setTeardownConfirmText('');
              setTeardownOpen(true);
            }}
            disabled={!!busy}
            className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
          >
            {busy === 'teardown' ? 'Removing…' : 'Delete team roles & channels'}
          </button>
        )}
      </div>

      {teardownOpen && (
        <TeardownConfirmModal
          status={status}
          confirmText={teardownConfirmText}
          setConfirmText={setTeardownConfirmText}
          onCancel={() => setTeardownOpen(false)}
          onConfirm={() => {
            setTeardownOpen(false);
            runAction('teardown');
          }}
        />
      )}

      {!draftComplete && (
        <p className="text-xs text-text-muted mt-2">
          Contestant role assignment unlocks when the draft is completed — captains get their roles as
          soon as you provision.
        </p>
      )}

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg mt-3 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}
    </details>
  );
}

// The teardown confirmation: an itemised list of every Discord resource about to be
// deleted (built from the same status the badges render from), gated behind typing
// DELETE — this nukes real channels with real message history, so a bare confirm()
// isn't enough friction.
function TeardownConfirmModal({
  status,
  confirmText,
  setConfirmText,
  onCancel,
  onConfirm,
}: {
  status: StatusData;
  confirmText: string;
  setConfirmText: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const affected = status.teams.filter((t) => t.hasRole || t.hasTextChannel || t.hasVoiceChannel);
  const roleN = affected.filter((t) => t.hasRole).length;
  const channelN = affected.reduce(
    (n, t) => n + (t.hasTextChannel ? 1 : 0) + (t.hasVoiceChannel ? 1 : 0),
    0,
  );
  const armed = confirmText.trim().toUpperCase() === 'DELETE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-card-bg border border-card-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 z-10">
          <h3 className="text-lg font-bold text-red-400">Delete team roles &amp; channels</h3>
          <p className="text-xs text-text-muted mt-1">
            This permanently deletes {roleN} role(s), {channelN} channel(s)
            {status.categoryId ? ' and the event category' : ''} from Discord — including all
            channel message history. It cannot be undone.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <ul className="space-y-1.5">
            {affected.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between border border-card-border rounded-lg p-2 text-sm"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-text-muted">
                  {[
                    t.hasRole && 'role',
                    t.hasTextChannel && 'text channel',
                    t.hasVoiceChannel && 'voice channel',
                  ]
                    .filter(Boolean)
                    .join(' + ')}
                </span>
              </li>
            ))}
            {status.categoryId && (
              <li className="flex items-center justify-between border border-card-border rounded-lg p-2 text-sm">
                <span className="font-medium">Event category</span>
                <span className="text-xs text-text-muted">category</span>
              </li>
            )}
          </ul>
          <p className="text-xs text-text-muted">
            Contestants lose channel access, and their team roles vanish with the roles. The shared
            bingo &amp; captain roles stay assigned — use “Remove bingo &amp; captain roles” for
            those.
          </p>
          <label className="block text-xs text-text-muted">
            Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="mt-1 bg-transparent rounded-lg text-text focus:border-red-400/60"
            />
          </label>
        </div>
        <div className="p-4 border-t border-card-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm font-medium border border-card-border px-4 py-2 rounded-lg hover:bg-card-border/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!armed}
            className="text-sm font-semibold bg-red-400/15 text-red-400 border border-red-400/30 px-4 py-2 rounded-lg hover:bg-red-400/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete everything listed
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border ${
        on
          ? 'bg-accent-green/10 text-accent-green-light border-accent-green/30'
          : 'bg-card-border/20 text-text-muted border-card-border'
      }`}
    >
      {on ? '✓' : '–'} {label}
    </span>
  );
}
