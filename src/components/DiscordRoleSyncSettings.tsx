'use client';

import { useEffect, useState } from 'react';
import DiscordLinkMember from './DiscordLinkMember';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';
import { nicknameMatchingOn, ROLE_MATCH_BY_NICKNAME_KEY } from '@/lib/discordRoleSafety';
import { useUnsavedChanges, UnsavedIndicator } from '@/components/UnsavedChanges';
import { useDialog } from '@/components/Confirm';

// Booleans are stored as the string 'true' (on). For role sync / nickname sync, anything
// other than 'true' = off. Auto-match defaults to ON, so it's stored as 'false' only when
// explicitly disabled (null/'' = on). Mirrors loadRoleSyncConfig() in lib/discord-roles.ts.
export default function DiscordRoleSyncSettings({
  notLinked = 0,
  unconfirmedLinks = 0,
}: {
  notLinked?: number;
  /** Members whose stored Discord link has no recorded source, so it earns no roles with matching off. */
  unconfirmedLinks?: number;
}) {
  const [roleSync, setRoleSync] = useState(false);
  const [nicknameSync, setNicknameSync] = useState(false);
  const [nicknameOverwrite, setNicknameOverwrite] = useState(false);
  const [autoMatch, setAutoMatch] = useState(true);
  // Off unless the clan turns it on (lib/discordRoleSafety ROLE_MATCH_BY_NICKNAME_KEY).
  const [nicknameMatch, setNicknameMatch] = useState(false);

  const [original, setOriginal] = useState({ roleSync: false, nicknameSync: false, nicknameOverwrite: false, autoMatch: true, nicknameMatch: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    synced: number;
    skipped: number;
    noChange?: number;
    bulk?: boolean;
    reports: Array<{ memberId: number; rsn: string; ok: boolean; reason?: string; resolved?: boolean; added?: number; removed?: number; nickSet?: string }>;
  } | null>(null);

  // Links this clan's admins made by hand (the "link…" control beside a skipped member), so one can
  // be removed. Character names and dates only.
  const [handLinks, setHandLinks] = useState<{ memberId: number; rsn: string; linkedAt: string | null }[]>([]);
  const [removingLink, setRemovingLink] = useState<number | null>(null);
  // "Saved" is a result, not a resting state: it shows after a save, never on first load.
  const [justSaved, setJustSaved] = useState(false);
  const { confirm } = useDialog();

  async function loadHandLinks() {
    try {
      const res = await clanFetch('/api/admin/discord/link-member');
      if (res.ok) setHandLinks((await res.json()).links ?? []);
    } catch {
      // The list is a convenience; the settings above work without it.
    }
  }

  async function removeHandLink(memberId: number, rsn: string) {
    const ok = await confirm({
      title: `Remove the Discord link for ${rsn}?`,
      body: 'Anvil stops giving this member roles through the link. Roles they already have stay until you remove them in Discord.',
      confirmLabel: 'Remove link',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingLink(memberId);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/link-member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanMemberId: memberId }),
      });
      if (res.ok) {
        setHandLinks((links) => links.filter((l) => l.memberId !== memberId));
        setMessage({ type: 'success', text: 'Link removed. Roles they already hold stay until you remove them in Discord.' });
      } else {
        setMessage({ type: 'error', text: (await res.json().catch(() => ({}))).error || 'Could not remove the link' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not remove the link' });
    } finally {
      setRemovingLink(null);
    }
  }

  // Force a full re-sync of every member's Discord roles + nicknames now (empty body = sweep).
  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/sync-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
        // A link made from the last result's "link…" control shows up in the list below.
        void loadHandLinks();
      } else setMessage({ type: 'error', text: data.error || 'Sync failed' });
    } catch {
      setMessage({ type: 'error', text: 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        const next = {
          roleSync: data.discord_role_sync_enabled === 'true',
          nicknameSync: data.discord_nickname_sync_enabled === 'true',
          nicknameOverwrite: data.discord_nickname_overwrite === 'true',
          autoMatch: data.discord_auto_match_rank_by_name !== 'false',
          nicknameMatch: nicknameMatchingOn(data[ROLE_MATCH_BY_NICKNAME_KEY]),
        };
        setRoleSync(next.roleSync);
        setNicknameSync(next.nicknameSync);
        setNicknameOverwrite(next.nicknameOverwrite);
        setAutoMatch(next.autoMatch);
        setNicknameMatch(next.nicknameMatch);
        setOriginal(next);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
      await loadHandLinks();
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_role_sync_enabled: roleSync ? 'true' : '',
          discord_nickname_sync_enabled: nicknameSync ? 'true' : '',
          discord_nickname_overwrite: nicknameOverwrite ? 'true' : '',
          // On = clear the override (defaults to on); Off = explicit 'false'.
          discord_auto_match_rank_by_name: autoMatch ? '' : 'false',
          [ROLE_MATCH_BY_NICKNAME_KEY]: nicknameMatch ? 'true' : '',
        }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal({ roleSync, nicknameSync, nicknameOverwrite, autoMatch, nicknameMatch });
        setJustSaved(true);
        setMessage({ type: 'success', text: 'Saved.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    roleSync !== original.roleSync ||
    nicknameSync !== original.nicknameSync ||
    nicknameOverwrite !== original.nicknameOverwrite ||
    autoMatch !== original.autoMatch ||
    nicknameMatch !== original.nicknameMatch;
  useUnsavedChanges(hasChanges);

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings…</div>;
  }

  return (
    <div className="space-y-4">
      {/* These four were Checkbox's own markup, hand-written: the same label span, the same
          description span, the same accent. The disabled ones even re-implemented the dimming the
          component already does, which is why the opacity was on the label text and not the box. */}
      <Checkbox
        checked={roleSync}
        onChange={setRoleSync}
        label="Enable Discord role sync"
        description="Gives members who have signed in to Anvil the Discord role that matches their in-game clan rank, plus any default roles. Needs the Anvil bot in your server (Connection, above). Nickname sync below also needs this on."
      />

      <Checkbox
        checked={nicknameMatch}
        onChange={setNicknameMatch}
        disabled={!roleSync}
        label="Also match members by Discord nickname"
        description={
          <>
            Off: only people who signed in to Anvil with Discord, or whom an admin linked by hand, get roles; a
            Discord account that was matched by name before no longer counts. On: a member who has not signed in
            also gets their roles when someone in your server has a nickname or username that matches their
            in-game name. Anyone in your server can set their nickname to such a member&apos;s name and receive
            that member&apos;s roles, without signing in to Anvil. Members who signed in are never affected.
            {nicknameMatch && notLinked > 0 && (
              <>
                {' '}
                {notLinked} current {notLinked === 1 ? 'member has' : 'members have'} not signed in with Discord and
                can only be matched this way.
              </>
            )}
          </>
        }
      />
      {original.roleSync && !original.nicknameMatch && notLinked > 0 && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          {notLinked} {notLinked === 1 ? 'member has' : 'members have'} not linked Discord and will not get roles
          until they sign in, an admin links them by hand, or you turn this on.
          {unconfirmedLinks > 0 && (
            <>
              {' '}
              {unconfirmedLinks} of them {unconfirmedLinks === 1 ? 'has' : 'have'} a Discord link saved before Anvil
              recorded who made it, so it does not count. To confirm one, sync below and use &quot;link…&quot; beside
              their name, or ask them to sign in with Discord.
            </>
          )}
        </p>
      )}

      <Checkbox
        checked={nicknameSync}
        onChange={setNicknameSync}
        disabled={!roleSync}
        label="Set Discord nickname to linked RSN(s) on link"
        description={
          <>
            Sets it to their RSN(s), primary first (e.g.{' '}
            <code className="text-gold">Drenvox mdps / Denoverse</code>), trimming trailing names to fit
            Discord&apos;s 32-char cap. Bot needs the &quot;Manage Nicknames&quot; permission and a role
            above the members it renames.
          </>
        }
      />

      <Checkbox
        checked={nicknameOverwrite}
        onChange={setNicknameOverwrite}
        disabled={!roleSync || !nicknameSync}
        className="pl-7"
        label="Overwrite existing nicknames too"
        description="Also replaces a nickname someone already set, keeping everyone pinned to their RSN(s) — so an in-game rename fixes their Discord name on the next sync. Off = only fill blank nicknames."
      />

      <Checkbox
        checked={autoMatch}
        onChange={setAutoMatch}
        disabled={!roleSync}
        label="Auto-match in-game rank → Discord role by name"
        description="Matches a rank to a Discord role of the same name (e.g. &quot;General&quot;). On unless you map ranks to role IDs manually."
      />

      {message && (
        <div
          className={`text-sm px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2 bg-gold text-brown-dark font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {justSaved && !hasChanges && !saving && <span className="text-xs text-green-400">Saved</span>}
        <UnsavedIndicator dirty={hasChanges} />
      </div>

      {/* Force a full re-sync now — applies roles + nicknames to everyone and reports who was
          skipped and why (e.g. has not signed in with Discord). Needs role sync enabled + saved. */}
      <div className="border-t border-card-border pt-4">
        <button
          onClick={runSync}
          disabled={syncing || !original.roleSync || hasChanges}
          title={
            !original.roleSync
              ? 'Enable and save role sync first'
              : hasChanges
                ? 'Save your changes first'
                : 'Re-apply roles + nicknames to every member now'
          }
          className="px-4 py-2 text-sm font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing everyone…' : 'Sync roles & nicknames now'}
        </button>

        {syncResult && (
          <div className="mt-3 text-sm space-y-2">
            <p>
              <span className="text-green-400">Synced {syncResult.synced}/{syncResult.total}</span>
              {syncResult.skipped > 0 && (
                <span className="text-yellow-400"> · {syncResult.skipped} skipped</span>
              )}
              {!!syncResult.noChange && (
                <span className="text-text-muted"> · {syncResult.noChange} no change</span>
              )}
              .
            </p>
            {syncResult.bulk === false && (
              <p className="text-[11px] text-text-muted">
                Tip: enable the bot&apos;s <span className="text-foreground/80">Server Members Intent</span> (Discord
                Developer Portal) so large rosters sync in one fetch instead of per-member calls.
              </p>
            )}

            {/* Changed — who actually got a role added / removed or a nickname set. */}
            {syncResult.reports.some((r) => r.ok && ((r.added ?? 0) > 0 || (r.removed ?? 0) > 0 || r.nickSet)) && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
                  Show changes applied
                </summary>
                <ul className="mt-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                  {syncResult.reports
                    .filter((r) => r.ok && ((r.added ?? 0) > 0 || (r.removed ?? 0) > 0 || r.nickSet))
                    .map((r) => (
                      <li key={r.rsn} className="text-xs text-text-muted">
                        <span className="text-foreground/80">{r.rsn}</span>
                        {(r.added ?? 0) > 0 && <span className="text-green-400"> +{r.added} role(s)</span>}
                        {(r.removed ?? 0) > 0 && <span className="text-red-400"> −{r.removed} role(s)</span>}
                        {r.nickSet && <span className="text-gold"> · nick → {r.nickSet}</span>}
                      </li>
                    ))}
                </ul>
              </details>
            )}

            {/* Resolved but nothing to give — the tell for a role-config gap (no rank map / default /
                guest role IDs set) rather than a linking problem. */}
            {!!syncResult.noChange && (
              <details>
                <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
                  Show resolved-but-no-role ({syncResult.noChange})
                </summary>
                <p className="text-[11px] text-text-muted mt-1">
                  These linked fine but got no role — either they already have every role, or no
                  rank/default/guest role IDs are configured for them.
                </p>
                <ul className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                  {syncResult.reports
                    .filter((r) => r.ok && (r.added ?? 0) === 0 && (r.removed ?? 0) === 0 && !r.nickSet)
                    .map((r) => (
                      <li key={r.rsn} className="text-xs text-text-muted">
                        <span className="text-foreground/80">{r.rsn}</span>
                      </li>
                    ))}
                </ul>
              </details>
            )}

            {syncResult.skipped > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
                  Show skipped ({syncResult.skipped})
                </summary>
                <ul className="mt-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                  {syncResult.reports
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.rsn} className="text-xs text-text-muted">
                        <span className="text-foreground/80">{r.rsn}</span> — {r.reason ?? 'unknown'}
                        <DiscordLinkMember memberId={r.memberId} />
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {handLinks.length > 0 && (
        <details className="border-t border-card-border pt-4">
          <summary className="cursor-pointer text-sm text-text-muted hover:text-foreground">
            Linked by hand ({handLinks.length})
          </summary>
          <p className="mt-1.5 text-xs text-text-muted">
            Members an admin pointed at a Discord account. They get roles like anyone who signed in. If the member
            signs in with a different Discord account, their own sign-in is used instead.
          </p>
          <ul className="mt-2 max-h-64 divide-y divide-card-border overflow-y-auto">
            {handLinks.map((l) => (
              <li key={l.memberId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5 text-xs text-text-muted">
                <span className="min-w-0">
                  <span className="text-sm text-foreground/90">{l.rsn}</span>
                  {l.linkedAt && <> · linked {l.linkedAt.slice(0, 10)}</>}
                </span>
                <button
                  type="button"
                  onClick={() => removeHandLink(l.memberId, l.rsn)}
                  disabled={removingLink === l.memberId}
                  className="shrink-0 rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:border-red-400/70 hover:bg-red-500/10 disabled:opacity-50 max-sm:min-h-11"
                >
                  {removingLink === l.memberId ? 'Removing…' : 'Remove link'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
