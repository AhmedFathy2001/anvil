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
  teams: TeamState[];
  fullyProvisioned: boolean;
}

// Admin panel for an event's Teams tab: create per-team Discord roles + locked channels,
// and assign contestant roles once the draft is done. Hidden entirely when the feature
// is disabled, so it only shows up for clans that have wired up the bot.
export default function DiscordTeamProvisioning({ eventId }: { eventId: number }) {
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

  async function runAction(action: 'provision' | 'assign-rosters' | 'teardown') {
    if (action === 'teardown' && !confirm('Delete this event’s team roles, channels, and category in Discord? Contestants will lose channel access. This cannot be undone.')) {
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
        if (action === 'provision') {
          text = `Provisioned ${r.teams?.length ?? 0} team(s)${r.captainsAssigned ? `, ${r.captainsAssigned} captain(s) assigned` : ''}.`;
        } else if (action === 'assign-rosters') {
          text = `Assigned roles to ${r.assigned ?? 0} contestant(s)${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}.`;
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

  // Loading, or the feature is off for this clan — render nothing.
  if (loading) return null;
  if (!status || !status.enabled) return null;

  const draftComplete = status.draftStatus === 'completed';
  const anyProvisioned = status.teams.some((t) => t.hasRole || t.hasTextChannel || t.hasVoiceChannel);

  return (
    <div className="pt-8 border-t border-card-border">
      <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
        <span className="w-1 h-5 bg-indigo-400 rounded-full" />
        Discord Channels &amp; Roles
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Create a private voice + text channel per team and assign Discord roles. You can provision
        roles &amp; channels now; contestant roles are assigned automatically when the draft completes
        (or with the button below).
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
        <button
          onClick={() => runAction('provision')}
          disabled={!!busy || status.teams.length === 0}
          className="text-sm font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {busy === 'provision' ? 'Provisioning…' : status.fullyProvisioned ? 'Re-sync Roles & Channels' : 'Create Roles & Channels'}
        </button>

        <button
          onClick={() => runAction('assign-rosters')}
          disabled={!!busy || !draftComplete || !status.fullyProvisioned}
          title={!draftComplete ? 'Available once the draft is completed' : !status.fullyProvisioned ? 'Provision roles & channels first' : undefined}
          className="text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
        >
          {busy === 'assign-rosters' ? 'Assigning…' : 'Assign Contestant Roles'}
        </button>

        {anyProvisioned && (
          <button
            onClick={() => runAction('teardown')}
            disabled={!!busy}
            className="text-sm font-medium bg-red-400/10 text-red-400 border border-red-400/20 px-4 py-2 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
          >
            {busy === 'teardown' ? 'Removing…' : 'Remove Discord Setup'}
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
