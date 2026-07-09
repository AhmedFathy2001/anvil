'use client';

import { useCallback, useEffect, useState } from 'react';

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

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/discord`);
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runAction(action: 'sync-all' | 'provision' | 'assign-rosters' | 'assign-bingo-role' | 'unassign-shared-roles' | 'teardown') {
    if (action === 'teardown' && !confirm('Delete this event’s team roles, channels, and category in Discord? Contestants lose channel access, and their team roles vanish with the roles. The shared bingo & captain roles stay assigned — use “Remove bingo & captain roles” for those. This cannot be undone.')) {
      return;
    }
    if (
      action === 'unassign-shared-roles' &&
      !confirm('Take the shared bingo role off everyone in this event, and the captain role off its captains? The roles themselves are kept (they’re reused across events). Heads up: these roles are shared, so anyone also in another active event loses them there too.')
    ) {
      return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/events/${eventId}/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.report || {};
        let text = 'Done.';
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
          text = `Removed ${r.rolesDeleted ?? 0} role(s) and ${r.channelsDeleted ?? 0} channel(s).`;
        }
        setMessage({ type: 'success', text });
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
          <a href="/admin/integrations" className="text-gold hover:underline">
            Advanced settings → Discord team channels
          </a>{' '}
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
            onClick={() => runAction('teardown')}
            disabled={!!busy}
            className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
          >
            {busy === 'teardown' ? 'Removing…' : 'Delete team roles & channels'}
          </button>
        )}
      </div>

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
