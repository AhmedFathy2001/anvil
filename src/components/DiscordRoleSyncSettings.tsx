'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';

// Booleans are stored as the string 'true' (on). For role sync / nickname sync, anything
// other than 'true' = off. Auto-match defaults to ON, so it's stored as 'false' only when
// explicitly disabled (null/'' = on). Mirrors loadRoleSyncConfig() in lib/discord-roles.ts.
export default function DiscordRoleSyncSettings() {
  const [roleSync, setRoleSync] = useState(false);
  const [nicknameSync, setNicknameSync] = useState(false);
  const [nicknameOverwrite, setNicknameOverwrite] = useState(false);
  const [autoMatch, setAutoMatch] = useState(true);
  const [guildId, setGuildId] = useState('');

  const [original, setOriginal] = useState({ roleSync: false, nicknameSync: false, nicknameOverwrite: false, autoMatch: true, guildId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    synced: number;
    skipped: number;
    reports: Array<{ rsn: string; ok: boolean; reason?: string; nickSet?: string }>;
  } | null>(null);

  // Force a full re-sync of every member's Discord roles + nicknames now (empty body = sweep).
  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/discord/sync-roles', {
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
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          const next = {
            roleSync: data.discord_role_sync_enabled === 'true',
            nicknameSync: data.discord_nickname_sync_enabled === 'true',
            nicknameOverwrite: data.discord_nickname_overwrite === 'true',
            autoMatch: data.discord_auto_match_rank_by_name !== 'false',
            guildId: data.discord_guild_id || '',
          };
          setRoleSync(next.roleSync);
          setNicknameSync(next.nicknameSync);
          setNicknameOverwrite(next.nicknameOverwrite);
          setAutoMatch(next.autoMatch);
          setGuildId(next.guildId);
          setOriginal(next);
        }
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
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_role_sync_enabled: roleSync ? 'true' : '',
          discord_nickname_sync_enabled: nicknameSync ? 'true' : '',
          discord_nickname_overwrite: nicknameOverwrite ? 'true' : '',
          // On = clear the override (defaults to on); Off = explicit 'false'.
          discord_auto_match_rank_by_name: autoMatch ? '' : 'false',
          discord_guild_id: guildId.trim(),
        }),
      });
      if (res.ok) {
        setOriginal({ roleSync, nicknameSync, nicknameOverwrite, autoMatch, guildId: guildId.trim() });
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
    guildId.trim() !== original.guildId;

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings…</div>;
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={roleSync}
          onChange={(e) => setRoleSync(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-gold"
        />
        <span>
          <span className="text-sm font-medium">Enable Discord role sync</span>
          <span className="block text-xs text-text-muted">
            Gives linked members their rank + default Discord roles. Requires the{' '}
            <code className="text-gold">DISCORD_BOT_TOKEN</code> env var and the Server ID below. Master
            switch — nickname sync also requires this on.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={nicknameSync}
          onChange={(e) => setNicknameSync(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-gold"
          disabled={!roleSync}
        />
        <span>
          <span className={`text-sm font-medium ${!roleSync ? 'opacity-50' : ''}`}>
            Set Discord nickname to linked RSN(s) on link
          </span>
          <span className="block text-xs text-text-muted">
            Sets it to their RSN(s), primary first (e.g. <code className="text-gold">Drenvox mdps / Denoverse</code>),
            trimming trailing names to fit Discord&apos;s 32-char cap. Bot needs the &quot;Manage
            Nicknames&quot; permission and a role above the members it renames.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer select-none pl-7">
        <input
          type="checkbox"
          checked={nicknameOverwrite}
          onChange={(e) => setNicknameOverwrite(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-gold"
          disabled={!roleSync || !nicknameSync}
        />
        <span>
          <span className={`text-sm font-medium ${!roleSync || !nicknameSync ? 'opacity-50' : ''}`}>
            Overwrite existing nicknames too
          </span>
          <span className="block text-xs text-text-muted">
            Also replaces a nickname someone already set, keeping everyone pinned to their RSN(s) — so
            an in-game rename fixes their Discord name on the next sync. Off = only fill blank nicknames.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoMatch}
          onChange={(e) => setAutoMatch(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-gold"
          disabled={!roleSync}
        />
        <span>
          <span className={`text-sm font-medium ${!roleSync ? 'opacity-50' : ''}`}>
            Auto-match in-game rank → Discord role by name
          </span>
          <span className="block text-xs text-text-muted">
            Matches a rank to a Discord role of the same name (e.g. &quot;General&quot;). On unless you
            map ranks to role IDs manually.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium mb-1">Discord Server (guild) ID</label>
        <Input
          value={guildId}
          onChange={(e) => setGuildId(e.target.value)}
          placeholder="e.g. 123456789012345678"
          className="w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <p className="text-xs text-text-muted mt-1">
          Right-click your server icon in Discord → Copy Server ID (needs Developer Mode on).
        </p>
      </div>

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
          <div className="mt-3 text-sm">
            <p className="text-green-400">
              Synced {syncResult.synced}/{syncResult.total}
              {syncResult.skipped > 0 && (
                <span className="text-yellow-400"> · {syncResult.skipped} skipped</span>
              )}
              .
            </p>
            {syncResult.skipped > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-text-muted hover:text-foreground">
                  Show skipped members
                </summary>
                <ul className="mt-1.5 space-y-0.5 max-h-52 overflow-y-auto">
                  {syncResult.reports
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={r.rsn} className="text-xs text-text-muted">
                        <span className="text-foreground/80">{r.rsn}</span> — {r.reason ?? 'unknown'}
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
