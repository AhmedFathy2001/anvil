'use client';

import { useEffect, useState } from 'react';
import { loadSettings, invalidateSettings } from '@/lib/settingsClient';
import RoleSelect from '@/components/RoleSelect';
import { clanFetch } from '@/lib/clanFetch';
import Checkbox from '@/components/Checkbox';

// No baked-in defaults — these are clan-specific Discord role IDs each instance enters once.
const DEFAULT_BINGO_ROLE_ID = '';
const DEFAULT_CAPTAIN_ROLE_ID = '';

// Mirrors loadTeamChannelConfig() in lib/discord-teams.ts. The bot token + server ID
// come from the "Discord roles & nicknames" section / env — this section reuses them.
export default function DiscordTeamChannelSettings() {
  const [teamSync, setTeamSync] = useState(false);
  const [cohostRoleSync, setCohostRoleSync] = useState(false);
  const [bingoRoleId, setBingoRoleId] = useState('');
  const [captainRoleId, setCaptainRoleId] = useState('');

  const [original, setOriginal] = useState({ teamSync: false, cohostRoleSync: false, bingoRoleId: '', captainRoleId: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        const next = {
          teamSync: data.discord_team_sync_enabled === 'true',
          cohostRoleSync: data.discord_cohost_role_sync_enabled === 'true',
          bingoRoleId: data.discord_bingo_role_id || DEFAULT_BINGO_ROLE_ID,
          captainRoleId: data.discord_captain_role_id || DEFAULT_CAPTAIN_ROLE_ID,
        };
        setTeamSync(next.teamSync);
        setCohostRoleSync(next.cohostRoleSync);
        setBingoRoleId(next.bingoRoleId);
        setCaptainRoleId(next.captainRoleId);
        // Compare against what's actually stored, so prefilled defaults show as
        // "unsaved" and a Save persists them.
        setOriginal({
          teamSync: next.teamSync,
          cohostRoleSync: next.cohostRoleSync,
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
          discord_cohost_role_sync_enabled: cohostRoleSync ? 'true' : '',
          discord_bingo_role_id: bingoRoleId.trim(),
          discord_captain_role_id: captainRoleId.trim(),
        }),
      });
      if (res.ok) {
        invalidateSettings();
        setOriginal({ teamSync, cohostRoleSync, bingoRoleId: bingoRoleId.trim(), captainRoleId: captainRoleId.trim() });
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
    cohostRoleSync !== original.cohostRoleSync ||
    bingoRoleId.trim() !== original.bingoRoleId ||
    captainRoleId.trim() !== original.captainRoleId;

  if (loading) {
    return <div className="text-text-muted text-sm">Loading settings…</div>;
  }

  return (
    <div className="space-y-4">
      <Checkbox
        checked={teamSync}
        onChange={setTeamSync}
        label="Give each team its own Discord channels"
        description={
          <>
            During an event, each team gets a private text and voice channel and a team role, set up from the
            event&apos;s Teams page and removed afterwards. Needs the Anvil bot in your server (Connection,
            above) with the <em>Manage Roles</em> and <em>Manage Channels</em> permissions, and the bot&apos;s
            role dragged above the team roles it makes (Server Settings → Roles).
          </>
        }
      />

      <Checkbox
        checked={cohostRoleSync}
        onChange={setCohostRoleSync}
        label="Also do this for events another clan hosts"
        description={
          <>
            When your clan plays in another clan&apos;s event, your admins can hand your members the player role
            below in <em>your</em> Discord. The other clan can ask you to, but can&apos;t do it for you.
          </>
        }
      />

      <div>
        <label className="block text-sm font-medium mb-1">Player role</label>
        <RoleSelect
          value={bingoRoleId}
          onChange={setBingoRoleId}
          ariaLabel="Player role"
          className="max-w-sm"
        />
        <p className="text-xs text-text-muted mt-1">
          Given to everyone playing in the event, so you can ping them all at once (e.g. “@Bingo”).
        </p>
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
          Given to each team&apos;s captain when the team channels are made. Leave as “No role” to skip it.
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
