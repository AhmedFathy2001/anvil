'use client';

import { useEffect, useState } from 'react';
import DiscordLinkMember from './DiscordLinkMember';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

// Booleans are stored as the string 'true' (on). For role sync / nickname sync, anything
// other than 'true' = off. Auto-match defaults to ON, so it's stored as 'false' only when
// explicitly disabled (null/'' = on). Mirrors loadRoleSyncConfig() in lib/discord-roles.ts.
export default function DiscordRoleSyncSettings() {
  const [roleSync, setRoleSync] = useState(false);
  const [nicknameSync, setNicknameSync] = useState(false);
  const [nicknameOverwrite, setNicknameOverwrite] = useState(false);
  const [autoMatch, setAutoMatch] = useState(true);

  const [original, setOriginal] = useState({ roleSync: false, nicknameSync: false, nicknameOverwrite: false, autoMatch: true });
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
      if (res.ok) setSyncResult(data);
      else setMessage({ type: 'error', text: data.error || 'Sync failed' });
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
        };
        setRoleSync(next.roleSync);
        setNicknameSync(next.nicknameSync);
        setNicknameOverwrite(next.nicknameOverwrite);
        setAutoMatch(next.autoMatch);
        setOriginal(next);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
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
        }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal({ roleSync, nicknameSync, nicknameOverwrite, autoMatch });
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
    autoMatch !== original.autoMatch;

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
        description="Gives linked members their rank + default Discord roles. Requires the bot connected in the Discord bot tab. Master switch — nickname sync also requires this on."
      />

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
          className="px-4 py-2 bg-gold text-bg font-semibold rounded-lg text-sm hover:bg-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {!hasChanges && <span className="text-xs text-green-400">Saved</span>}
        {hasChanges && <span className="text-xs text-yellow-400">Unsaved changes</span>}
      </div>

      {/* Force a full re-sync now — applies roles + nicknames to everyone and reports who was
          skipped and why (e.g. no Discord id linkable). Needs role sync enabled + saved. */}
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
    </div>
  );
}
