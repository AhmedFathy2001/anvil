'use client';

import { useCallback, useEffect, useState } from 'react';
import { clanFetch } from '@/lib/clanFetch';
import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';

interface TeamState {
  id: number;
  name: string;
  clanId: number | null;
  hasRole: boolean;
  hasTextChannel: boolean;
  hasVoiceChannel: boolean;
}

interface StatusData {
  isHost: boolean;
  clanName: string;
  discordLayout: 'own' | 'joint' | 'single';
  enabled: boolean;
  categoryId: string | null;
  draftStatus: string;
  rostersReady: boolean;
  bingoRoleConfigured: boolean;
  captainRoleConfigured: boolean;
  approvedSignups: number;
  teams: TeamState[];
  fullyProvisioned: boolean;
  ownTeamId: number | null;
  ownTeamName: string | null;
  cohosts: { clanId: number; clanName: string }[];
}

type ProvisionScope = 'all-teams' | 'own-clan';
type DiscordAction =
  | 'sync-all'
  | 'provision'
  | 'assign-rosters'
  | 'assign-bingo-role'
  | 'unassign-shared-roles'
  | 'teardown'
  | 'request-cohost-setup'
  | 'assign-cohost-bingo-role'
  | 'unassign-cohost-bingo-role';

// Admin panel for an event's Teams tab: create per-team Discord roles + locked channels,
// and assign contestant roles once rosters are final (drafted or directly assigned). Hidden
// entirely when the feature is
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
  const [scope, setScope] = useState<ProvisionScope | null>(null);
  const { confirm } = useDialog();
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

  useEffect(() => {
    if (!status || scope !== null) return;
    setScope(status.ownTeamId && status.cohosts.length > 0 ? 'own-clan' : 'all-teams');
  }, [scope, status]);

  async function runAction(action: DiscordAction) {
    if (action === 'unassign-shared-roles' || action === 'unassign-cohost-bingo-role') {
      const ok = await confirm({
        title: 'Take the shared roles back off everyone?',
        body:
          'The bingo role comes off every player in this event and the captain role off its captains. The roles themselves are kept — they are reused across events, which is also the catch: anyone who is in another active event loses them there too.',
        confirmLabel: 'Take them off',
      });
      if (!ok) return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const res = await clanFetch(`/api/events/${eventId}/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, scope: scope ?? 'all-teams' }),
      });
      const data = await res.json();
      if (res.ok) {
        const r = data.report || {};
        const roleServerNote = (report: { roleServers?: { failed?: number }[] } | undefined) => {
          const servers = report?.roleServers ?? [];
          if (servers.length <= 1) return '';
          const failed = servers.reduce((sum, server) => sum + (server.failed ?? 0), 0);
          return ` across ${servers.length} approved Discord servers${failed ? ` (${failed} assignment(s) failed — usually the member is not in that server)` : ''}`;
        };
        let text = 'Done.';
        let type: 'success' | 'error' = 'success';
        if (action === 'sync-all') {
          const teamsN = r.provision?.teams?.length ?? 0;
          const assignedN = r.assign?.assigned ?? 0;
          const skippedN = r.assign?.skipped ?? 0;
          text = `Set up ${teamsN} team channel(s) and assigned roles to ${assignedN} contestant(s)${roleServerNote(r.assign)}${skippedN ? `, ${skippedN} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'provision') {
          text = `Provisioned ${r.teams?.length ?? 0} team(s)${r.captainsAssigned ? `, ${r.captainsAssigned} captain(s) assigned` : ''}.`;
        } else if (action === 'assign-rosters') {
          text = `Assigned roles to ${r.assigned ?? 0} contestant(s)${roleServerNote(r)}${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'assign-bingo-role') {
          text = `Gave the bingo role to ${r.assigned ?? 0} approved contestant(s)${roleServerNote(r)}${r.skipped ? `, ${r.skipped} skipped (no linked Discord)` : ''}.`;
        } else if (action === 'unassign-shared-roles') {
          text = `Removed the bingo role from ${r.bingoRemoved ?? 0} member(s) and the captain role from ${r.captainRemoved ?? 0}.`;
        } else if (action === 'assign-cohost-bingo-role') {
          text = `Gave ${status?.clanName ?? 'this clan'}'s bingo role to ${r.changed ?? 0} member(s)${r.failed ? `; ${r.failed} were not in this Discord or could not receive it` : ''}.`;
        } else if (action === 'unassign-cohost-bingo-role') {
          text = `Removed ${status?.clanName ?? 'this clan'}'s bingo role from ${r.changed ?? 0} member(s).`;
        } else if (action === 'request-cohost-setup') {
          const reports = Array.isArray(data.report) ? data.report : [];
          const sent = reports.filter((item: { status?: string }) => item.status === 'sent').length;
          const skipped = reports.filter((item: { status?: string }) => item.status === 'skipped').length;
          const failed = reports.filter((item: { status?: string }) => item.status === 'failed').length;
          text = `Setup request sent to ${sent} cohost Discord${sent === 1 ? '' : 's'}${skipped ? `; ${skipped} skipped because their cohost channel is off or missing` : ''}${failed ? `; ${failed} failed` : ''}.`;
          if (sent === 0) type = 'error';
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

  // Joint/single-server events are fully represented by EventDiscordServerPanel on this page.
  // This older panel reads the host server's legacy team columns, so showing it alongside the
  // event-server state falsely makes successfully created roles/channels look missing.
  if (status?.isHost && status.discordLayout !== 'own') return null;

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
          everyone — automatically when a draft ends, or with a button for pre-assigned rosters.
        </p>
      </div>
    );
  }

  if (!status.isHost) {
    return (
      <div className="pt-8 border-t border-card-border">
        <h2 className="text-lg font-bold mb-1">{status.clanName} Discord setup</h2>
        <div className="mt-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
          <p className="font-semibold text-indigo-200">Only {status.clanName} admins control this server</p>
          <p className="mt-1 text-text-muted">
            The event host can ask you to set this up, but cannot assign your roles or create your
            channels. Actions here use only {status.clanName}&apos;s bot and configured bingo role.
          </p>
        </div>
        {status.bingoRoleConfigured ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => runAction('assign-cohost-bingo-role')}
              disabled={!!busy || status.approvedSignups === 0}
              className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
            >
              {busy === 'assign-cohost-bingo-role'
                ? 'Assigning…'
                : `Give ${status.clanName} bingo role to your entrants`}
            </button>
            <button
              onClick={() => runAction('unassign-cohost-bingo-role')}
              disabled={!!busy}
              className="text-sm font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 px-4 py-2 rounded-lg hover:bg-amber-400/20 transition-colors disabled:opacity-50"
            >
              {busy === 'unassign-cohost-bingo-role' ? 'Removing…' : `Remove ${status.clanName} bingo role`}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-text-muted">
            To use the role buttons, open{' '}
            <ClanLink href="/admin/integrations" className="text-gold hover:underline">
              Integrations → Discord team channels
            </ClanLink>
            , select your contestant role, and enable co-hosted event role tools. Private team
            channels remain entirely your clan&apos;s choice in Discord.
          </p>
        )}
        {message && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  const rostersReady = status.rostersReady;
  const anyProvisioned = status.teams.some((t) => t.hasRole || t.hasTextChannel || t.hasVoiceChannel);
  const selectedScope = scope ?? (status.ownTeamId && status.cohosts.length > 0 ? 'own-clan' : 'all-teams');
  const scopedTeams = selectedScope === 'own-clan'
    ? status.teams.filter((team) => team.id === status.ownTeamId)
    : status.teams;
  const scopedFullyProvisioned =
    scopedTeams.length > 0 &&
    scopedTeams.every((team) => team.hasRole && team.hasTextChannel && team.hasVoiceChannel);

  return (
    <details className="pt-8 border-t border-card-border group" open={anyProvisioned}>
      <summary className="cursor-pointer select-none list-none flex items-center gap-2 mb-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-400 rounded-full" />
          {status.clanName} Discord Channels &amp; Roles
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-text-muted px-1.5 py-0.5 rounded border border-card-border">
          Optional
        </span>
        <span className="ml-auto text-text-muted transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
        <p className="font-semibold text-indigo-200">These controls affect {status.clanName}&apos;s Discord only</p>
        <p className="mt-1 text-text-muted">
          A row named after a cohost is still an event team—it does not mean Anvil is changing that
          clan&apos;s server. Choose whether your Discord needs channels for every team or only your own.
        </p>
      </div>

      {status.ownTeamId && status.cohosts.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <ScopeOption
            checked={selectedScope === 'own-clan'}
            onChange={() => setScope('own-clan')}
            title={`${status.ownTeamName ?? status.clanName} only`}
            description={`Create one team channel/role and give shared roles only to ${status.clanName}'s entrants.`}
          />
          <ScopeOption
            checked={selectedScope === 'all-teams'}
            onChange={() => setScope('all-teams')}
            title="All event teams"
            description={`Create a channel/role for every team inside ${status.clanName}'s Discord and assign every entrant present there.`}
          />
        </div>
      )}

      {status.teams.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {status.teams.map((t) => (
            <div key={t.id} className={`flex items-center justify-between border rounded-lg p-2 bg-card-bg text-sm ${scopedTeams.some((team) => team.id === t.id) ? 'border-indigo-500/40' : 'border-card-border opacity-55'}`}>
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
        {/* One-click primary action once rosters are final: create channels/roles AND assign
            everyone. Drafts run this automatically; direct rosters use this button. */}
        {rostersReady && (
          <button
            onClick={() => runAction('sync-all')}
            disabled={!!busy || scopedTeams.length === 0}
            title={`Create the selected team channels and assign ${selectedScope === 'own-clan' ? `${status.clanName}'s` : 'all'} contestants — in this Discord only`}
            className="text-sm font-semibold bg-accent-green/25 text-accent-green-light border border-accent-green/50 px-4 py-2 rounded-lg hover:bg-accent-green/35 transition-colors disabled:opacity-50"
          >
            {busy === 'sync-all'
              ? 'Setting up…'
              : scopedFullyProvisioned
                ? `Re-sync ${selectedScope === 'own-clan' ? 'my team' : 'all teams'} in this Discord`
                : `Set up ${selectedScope === 'own-clan' ? 'my team' : 'all teams'} in this Discord`}
          </button>
        )}

        <button
          onClick={() => runAction('provision')}
          disabled={!!busy || scopedTeams.length === 0}
          className="text-sm font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {busy === 'provision'
            ? 'Provisioning…'
            : scopedFullyProvisioned
              ? 'Re-sync selected roles & channels'
              : 'Create selected roles & channels'}
        </button>

        <button
          onClick={() => runAction('assign-bingo-role')}
          disabled={!!busy || !status.bingoRoleConfigured || status.approvedSignups === 0}
          title={
            !status.bingoRoleConfigured
              ? 'Set a bingo role ID under Integrations → Discord team channels first'
              : status.approvedSignups === 0
                ? 'No approved sign-ups yet'
                : `Give the bingo role to ${selectedScope === 'own-clan' ? `${status.clanName}'s` : 'all'} approved contestant(s)`
          }
          className="text-sm font-medium bg-gold/15 text-gold border border-gold/30 px-4 py-2 rounded-lg hover:bg-gold/25 transition-colors disabled:opacity-50"
        >
          {busy === 'assign-bingo-role'
            ? 'Assigning…'
            : `Give bingo role to ${selectedScope === 'own-clan' ? 'my entrants' : 'all approved'}`}
        </button>

        <button
          onClick={() => runAction('assign-rosters')}
          disabled={!!busy || !rostersReady || !scopedFullyProvisioned}
          title={!rostersReady ? 'Assign every entrant and put at least one player on each team first' : !scopedFullyProvisioned ? 'Provision the selected roles & channels first' : undefined}
          className="text-sm font-medium bg-accent-green/15 text-accent-green-light border border-accent-green/30 px-4 py-2 rounded-lg hover:bg-accent-green/25 transition-colors disabled:opacity-50"
        >
          {busy === 'assign-rosters'
            ? 'Assigning…'
            : `Assign ${selectedScope === 'own-clan' ? 'my team' : 'all team'} roles`}
        </button>

        {(status.bingoRoleConfigured || status.captainRoleConfigured) && (
          <button
            onClick={() => runAction('unassign-shared-roles')}
            disabled={!!busy}
            title="Take the shared bingo & captain roles off this event’s members (the roles themselves are kept)"
            className="text-sm font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 px-4 py-2 rounded-lg hover:bg-amber-400/20 transition-colors disabled:opacity-50"
          >
            {busy === 'unassign-shared-roles'
              ? 'Removing…'
              : `Remove ${selectedScope === 'own-clan' ? 'my entrants’' : 'all'} bingo & captain roles`}
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

      {status.cohosts.length > 0 && (
        <div className="mt-4 rounded-lg border border-card-border bg-card-bg p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Cohost Discords are theirs to manage</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Ask {status.cohosts.map((cohost) => cohost.clanName).join(', ')} to configure their own
                bingo role and any private channels. This sends instructions only—it changes nothing
                in their server.
              </p>
            </div>
            <button
              onClick={() => runAction('request-cohost-setup')}
              disabled={!!busy}
              className="shrink-0 text-sm font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
            >
              {busy === 'request-cohost-setup' ? 'Sending request…' : 'Request cohost Discord setup'}
            </button>
          </div>
        </div>
      )}

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

      {!rostersReady && (
        <p className="text-xs text-text-muted mt-2">
          Contestant role assignment unlocks after the draft, or once every entrant is assigned and
          every direct-entry team has a player. Captains get their roles as soon as you provision.
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

function ScopeOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className={`cursor-pointer rounded-lg border p-3 transition-colors ${checked ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-card-border bg-card-bg hover:border-indigo-400/30'}`}>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <input type="radio" checked={checked} onChange={onChange} className="accent-indigo-400" />
        {title}
      </span>
      <span className="mt-1 block pl-5 text-xs text-text-muted">{description}</span>
    </label>
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
