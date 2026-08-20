'use client';

import { useEffect, useState } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import RoleSelect from '@/components/RoleSelect';
import { clanFetch } from '@/lib/clanFetch';

// No baked-in defaults — these are clan-specific Discord role IDs each instance enters once.
const DEFAULT_BINGO_ROLE_ID = '';
const DEFAULT_CAPTAIN_ROLE_ID = '';

// Mirrors loadTeamChannelConfig() in lib/discord-teams.ts. The bot token + server ID
// come from the "Discord roles & nicknames" section / env — this section reuses them.
export default function DiscordTeamChannelSettings() {
  const [teamSync, setTeamSync] = useState(false);
  const [bingoRoleId, setBingoRoleId] = useState('');
  const [captainRoleId, setCaptainRoleId] = useState('');

  const [original, setOriginal] = useState({ teamSync: false, bingoRoleId: '', captainRoleId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        const next = {
          teamSync: data.discord_team_sync_enabled === 'true',
          bingoRoleId: data.discord_bingo_role_id || DEFAULT_BINGO_ROLE_ID,
          captainRoleId: data.discord_captain_role_id || DEFAULT_CAPTAIN_ROLE_ID,
        };
        setTeamSync(next.teamSync);
        setBingoRoleId(next.bingoRoleId);
        setCaptainRoleId(next.captainRoleId);
        // Compare against what's actually stored, so prefilled defaults show as
        // "unsaved" and a Save persists them.
        setOriginal({
          teamSync: next.teamSync,
          bingoRoleId: data.discord_bingo_role_id || '',
          captainRoleId: data.discord_captain_role_id || '',
        });
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
          discord_team_sync_enabled: teamSync ? 'true' : '',
          discord_bingo_role_id: bingoRoleId.trim(),
          discord_captain_role_id: captainRoleId.trim(),
        }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal({ teamSync, bingoRoleId: bingoRoleId.trim(), captainRoleId: captainRoleId.trim() });
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
    teamSync !== original.teamSync ||
    bingoRoleId.trim() !== original.bingoRoleId ||
    captainRoleId.trim() !== original.captainRoleId;

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings…</div>;
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={teamSync}
          onChange={(e) => setTeamSync(e.target.checked)}
          className="h-4 w-4 mt-0.5 accent-gold"
        />
        <span>
          <span className="text-sm font-medium">Enable Discord team channels</span>
          <span className="block text-xs text-text-muted">
            Lets you provision a private voice + text channel per team from an event&apos;s Teams tab,
            and assign contestants their roles. Requires the bot connected in the Discord bot tab. The
            bot needs <em>Manage Roles</em> and <em>Manage Channels</em>, with its role above the team
            roles it creates.
          </span>
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium mb-1">Contestant (bingo) role</label>
        <RoleSelect
          value={bingoRoleId}
          onChange={setBingoRoleId}
          ariaLabel="Contestant (bingo) role"
          className="max-w-sm"
        />
        <p className="text-xs text-text-muted mt-1">Given to every drafted contestant.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Team captain role</label>
        <RoleSelect
          value={captainRoleId}
          onChange={setCaptainRoleId}
          ariaLabel="Team captain role"
          className="max-w-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          Given to each team&apos;s captain when channels are provisioned. Leave as “No role” to skip it.
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
    </div>
  );
}
