'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface ClanMember {
  id: number;
  rsn: string;
  rsnNormalized: string;
  discordId: string | null;
  rank: string | null;
  isGuest: number;
  source: 'manual' | 'plugin-self' | 'plugin-roster';
  joinedAt: string;
  leftAt: string | null;
  lastSeenInClan: string | null;
  notes: string | null;
  userId: number | null;
  provisional: number;
  pendingRole: 'admin' | 'moderator' | null;
}

interface PluginLink {
  id: number;
  userId: number;
  username: string | null;
  displayName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

type FilterMode = 'active' | 'guests' | 'left' | 'all';

export default function ClanRosterClient({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [links, setLinks] = useState<PluginLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('active');

  const [showAdd, setShowAdd] = useState(false);
  const [addRsn, setAddRsn] = useState('');
  const [addDiscord, setAddDiscord] = useState('');
  const [addRank, setAddRank] = useState('');
  const [addIsGuest, setAddIsGuest] = useState(false);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const [roleTarget, setRoleTarget] = useState<ClanMember | null>(null);
  const [roleValue, setRoleValue] = useState<'admin' | 'moderator' | 'none'>('none');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [codeGenerating, setCodeGenerating] = useState(false);
  const [codeError, setCodeError] = useState('');

  const [clanName, setClanName] = useState('');
  const [clanNameOriginal, setClanNameOriginal] = useState('');
  const [clanNameSaving, setClanNameSaving] = useState(false);
  const [clanNameMessage, setClanNameMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [renameTarget, setRenameTarget] = useState<ClanMember | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  async function fetchAll() {
    setLoading(true);
    const [mRes, lRes, sRes] = await Promise.all([
      fetch('/api/admin/clan'),
      fetch('/api/admin/plugin/links'),
      fetch('/api/admin/settings'),
    ]);
    if (mRes.ok) setMembers(await mRes.json());
    if (lRes.ok) setLinks(await lRes.json());
    if (sRes.ok) {
      const s = await sRes.json();
      setClanName(s.clan_name || '');
      setClanNameOriginal(s.clan_name || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function saveClanName() {
    setClanNameSaving(true);
    setClanNameMessage(null);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clan_name: clanName }),
    });
    if (res.ok) {
      setClanNameOriginal(clanName);
      setClanNameMessage({ type: 'ok', text: 'Saved.' });
    } else {
      const data = await res.json().catch(() => ({}));
      setClanNameMessage({ type: 'err', text: data.error || 'Failed to save' });
    }
    setClanNameSaving(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === 'active' && (m.leftAt || m.isGuest)) return false;
      if (filter === 'guests' && (!m.isGuest || m.leftAt)) return false;
      if (filter === 'left' && !m.leftAt) return false;
      if (q && !m.rsn.toLowerCase().includes(q) && !(m.rank || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [members, search, filter]);

  const counts = useMemo(() => {
    let active = 0, guests = 0, left = 0;
    for (const m of members) {
      if (m.leftAt) left++;
      else if (m.isGuest) guests++;
      else active++;
    }
    return { active, guests, left, total: members.length };
  }, [members]);

  async function generateLinkCode() {
    setCodeError('');
    setCodeGenerating(true);
    const res = await fetch('/api/admin/plugin/link-code', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCodeError(data.error || 'Failed to generate code');
      setCodeGenerating(false);
      return;
    }
    const data = await res.json();
    setLinkCode(data.code);
    setLinkExpiresAt(data.expiresAt);
    setCodeGenerating(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    const res = await fetch('/api/admin/clan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rsn: addRsn,
        discordId: addDiscord || undefined,
        rank: addRank || undefined,
        isGuest: addIsGuest,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setAddError(data.error || 'Failed to add');
      setAdding(false);
      return;
    }
    setAddRsn('');
    setAddDiscord('');
    setAddRank('');
    setAddIsGuest(false);
    setShowAdd(false);
    setAdding(false);
    fetchAll();
  }

  async function togglePromote(member: ClanMember) {
    const res = await fetch(`/api/admin/clan/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isGuest: member.isGuest === 0 }),
    });
    if (res.ok) fetchAll();
  }

  async function rejoinMember(member: ClanMember) {
    const res = await fetch(`/api/admin/clan/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejoin: true }),
    });
    if (res.ok) fetchAll();
  }

  async function removeMember(member: ClanMember) {
    if (!confirm(`Mark ${member.rsn} as left the clan?`)) return;
    const res = await fetch(`/api/admin/clan/${member.id}`, { method: 'DELETE' });
    if (res.ok) fetchAll();
  }

  function openRename(member: ClanMember) {
    setRenameTarget(member);
    setRenameValue(member.rsn);
    setRenameError('');
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('Enter a new RSN.');
      return;
    }
    setRenameSaving(true);
    setRenameError('');
    const res = await fetch(`/api/admin/clan/${renameTarget.id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRsn: trimmed }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'mergeRequired') {
        const counts = data.conflictCounts as { players: number; weeklyParticipants: number; pluginLinks: number } | undefined;
        const parts: string[] = [];
        if (counts?.players) parts.push(`${counts.players} player${counts.players === 1 ? '' : 's'}`);
        if (counts?.weeklyParticipants) parts.push(`${counts.weeklyParticipants} weekly entr${counts.weeklyParticipants === 1 ? 'y' : 'ies'}`);
        if (counts?.pluginLinks) parts.push(`${counts.pluginLinks} plugin link${counts.pluginLinks === 1 ? '' : 's'}`);
        setRenameError(
          `That RSN already exists with activity (${parts.join(', ') || 'linked history'}). Remove the other member manually first, then rename.`,
        );
      } else {
        setRenameError(data.error || data.message || 'Failed to rename');
      }
      setRenameSaving(false);
      return;
    }
    setRenameTarget(null);
    setRenameValue('');
    setRenameSaving(false);
    fetchAll();
  }

  function openRole(member: ClanMember) {
    setRoleTarget(member);
    setRoleValue(member.pendingRole ?? 'none');
    setRoleError('');
  }

  async function submitRole(e: React.FormEvent) {
    e.preventDefault();
    if (!roleTarget) return;
    setRoleSaving(true);
    setRoleError('');
    const res = await fetch(`/api/admin/clan/${roleTarget.id}/pending-role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleValue === 'none' ? null : roleValue }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRoleError(data.error || 'Failed to update role');
      setRoleSaving(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    const rsn = roleTarget.rsn;
    setRoleTarget(null);
    setRoleSaving(false);
    if (data.appliedNow) {
      setRoleNotice(`Promoted ${rsn} to ${data.user?.role ?? roleValue} immediately (already verified).`);
    } else if (roleValue === 'none') {
      setRoleNotice(`Cleared pending role for ${rsn}.`);
    } else {
      setRoleNotice(`Queued ${roleValue} role for ${rsn}. Will apply when they verify via Discord + plugin/mod approval.`);
    }
    setTimeout(() => setRoleNotice(null), 6000);
    fetchAll();
  }

  async function revokeLink(link: PluginLink) {
    if (!confirm(`Revoke plugin link for ${link.username ?? link.displayName ?? `user ${link.userId}`}?`)) return;
    const res = await fetch(`/api/admin/plugin/links/${link.id}`, { method: 'DELETE' });
    if (res.ok) fetchAll();
  }

  const activeLinks = links.filter((l) => !l.revokedAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold">Clan Roster</h1>
          <p className="text-text-muted text-sm mt-1">
            {counts.active} member{counts.active === 1 ? '' : 's'} · {counts.guests} guest
            {counts.guests === 1 ? '' : 's'} · {counts.left} departed
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-1.5 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors"
          >
            + Add Manually
          </button>
        </div>
      </div>

      {/* Clan settings */}
      <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Clan Settings
        </h2>
        <p className="text-text-muted text-sm mb-3">
          The plugin's roster-sync payload must match this clan name. Leave blank to accept any clan.
        </p>
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={clanName}
            onChange={(e) => {
              setClanName(e.target.value);
              setClanNameMessage(null);
            }}
            placeholder="e.g. The Golden Arrows"
            className="flex-1 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
          />
          <button
            onClick={saveClanName}
            disabled={clanNameSaving || clanName === clanNameOriginal}
            className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
          >
            {clanNameSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {clanNameMessage && (
          <p
            className={`text-xs mt-2 ${
              clanNameMessage.type === 'ok' ? 'text-accent-green-light' : 'text-red-400'
            }`}
          >
            {clanNameMessage.text}
          </p>
        )}
      </div>

      {/* Plugin link section */}
      <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-1 h-5 bg-gold rounded-full" />
              Plugin Linking
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Link your in-game account to the site so the RuneLite plugin can push clan roster updates.
            </p>
          </div>
          <button
            onClick={generateLinkCode}
            disabled={codeGenerating}
            className="px-4 py-1.5 text-sm font-semibold bg-gold/15 hover:bg-gold/25 text-gold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {codeGenerating ? 'Generating...' : 'Generate Link Code'}
          </button>
        </div>

        {codeError && <p className="text-red-400 text-sm mt-3">{codeError}</p>}

        {linkCode && (
          <div className="mt-4 border border-gold/30 rounded-lg p-4 bg-gold/5">
            <p className="text-xs text-text-muted mb-1">Paste this into the plugin config:</p>
            <p className="text-3xl font-mono font-bold tracking-[0.3em] text-gold">{linkCode}</p>
            {linkExpiresAt && (
              <p className="text-xs text-text-muted mt-2">
                Expires {new Date(linkExpiresAt).toLocaleTimeString()} — generate a new one if it lapses.
              </p>
            )}
          </div>
        )}

        {activeLinks.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wide">Active links</p>
            <div className="space-y-2">
              {activeLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between border border-card-border/60 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold">{link.username ?? link.displayName ?? `user ${link.userId}`}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">
                      {link.lastUsedAt
                        ? `used ${new Date(link.lastUsedAt).toLocaleString()}`
                        : 'never used'}
                    </span>
                    <button
                      onClick={() => revokeLink(link)}
                      className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 border border-card-border rounded-lg p-1 bg-card-bg">
          {(['active', 'guests', 'left', 'all'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === f ? 'bg-gold text-brown-dark font-semibold' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 opacity-70">
                ({f === 'active' ? counts.active : f === 'guests' ? counts.guests : f === 'left' ? counts.left : counts.total})
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RSN or rank..."
          className="flex-1 max-w-xs px-3 py-1.5 bg-brown-dark border border-card-border rounded text-sm"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Add Clan Member</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">RSN</label>
                <input
                  type="text"
                  value={addRsn}
                  onChange={(e) => setAddRsn(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="In-game name"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Discord ID (optional)</label>
                <input
                  type="text"
                  value={addDiscord}
                  onChange={(e) => setAddDiscord(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="e.g. 1234567890"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Rank (optional)</label>
                <input
                  type="text"
                  value={addRank}
                  onChange={(e) => setAddRank(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="member, general, captain..."
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addIsGuest}
                    onChange={(e) => setAddIsGuest(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Add as guest</span>
                </label>
              </div>
            </div>
            {addError && <p className="text-red-400 text-sm">{addError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading roster...</div>
      ) : (
        <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-text-muted">
                <th className="px-4 py-3 font-medium">RSN</th>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-card-border/50 hover:bg-card-bg-hover transition-colors ${m.leftAt ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium">
                    <div>{m.rsn}</div>
                    {m.pendingRole && (
                      <div className="mt-1">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            m.pendingRole === 'admin'
                              ? 'bg-gold/15 text-gold'
                              : 'bg-blue-500/15 text-blue-400'
                          }`}
                          title={
                            m.userId
                              ? m.provisional
                                ? `Will be granted ${m.pendingRole} once a mod approves their verification`
                                : `Pending — will apply on next role sync`
                              : `Will be granted ${m.pendingRole} when this RSN is claimed via Discord + verified`
                          }
                        >
                          → {m.pendingRole}
                          {!m.userId
                            ? ' (awaiting claim)'
                            : m.provisional
                              ? ' (awaiting mod approval)'
                              : ' (pending)'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{m.rank || '—'}</td>
                  <td className="px-4 py-3">
                    {m.leftAt ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
                        Left
                      </span>
                    ) : m.isGuest ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                        Guest
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{m.source}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {m.lastSeenInClan ? new Date(m.lastSeenInClan).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {m.leftAt ? (
                        <button
                          onClick={() => rejoinMember(m)}
                          className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                        >
                          Rejoin
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openRename(m)}
                            className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                          >
                            Rename
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => openRole(m)}
                              className="px-2 py-1 text-xs border border-gold/30 text-gold rounded hover:bg-gold/10 transition-colors"
                            >
                              Set role
                            </button>
                          )}
                          <button
                            onClick={() => togglePromote(m)}
                            className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                          >
                            {m.isGuest ? 'Promote' : 'Demote to guest'}
                          </button>
                          <button
                            onClick={() => removeMember(m)}
                            className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No members match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Role-assignment notice */}
      {roleNotice && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm border border-gold/30 bg-card-bg rounded-lg shadow-lg px-4 py-3 text-sm">
          {roleNotice}
        </div>
      )}

      {/* Set-role modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !roleSaving && setRoleTarget(null)}
          />
          <form
            onSubmit={submitRole}
            className="relative bg-card-bg border border-card-border rounded-xl w-full max-w-md p-5 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-gold mb-1">Pre-assign staff role</h2>
            <p className="text-text-muted text-sm mb-4">
              {roleTarget.userId
                ? roleTarget.provisional
                  ? `${roleTarget.rsn} has claimed this RSN but their verification is still provisional. The role will apply when a mod approves it.`
                  : `${roleTarget.rsn} is already linked and verified — the role applies immediately on save.`
                : `Stamps a role onto ${roleTarget.rsn}. When they sign in via Discord and verify (plugin or stat-delta), the role is granted automatically.`}
            </p>
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-1">Role</label>
              <select
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value as 'admin' | 'moderator' | 'none')}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
              >
                <option value="none">None (clear)</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {roleError && <p className="text-red-400 text-sm mb-3">{roleError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={roleSaving}
                onClick={() => setRoleTarget(null)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={roleSaving}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {roleSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !renameSaving && setRenameTarget(null)}
          />
          <form
            onSubmit={submitRename}
            className="relative bg-card-bg border border-card-border rounded-xl w-full max-w-md p-5 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-gold mb-1">Rename clan member</h2>
            <p className="text-text-muted text-sm mb-4">
              Updates the RSN everywhere it's used — active event enrollments, weekly participants,
              and any linked admin plugin token. Submissions and completed events aren't affected.
            </p>
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">Current RSN</label>
              <div className="px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-text-muted">
                {renameTarget.rsn}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">New RSN</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                autoFocus
                maxLength={32}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                placeholder="New in-game name"
              />
            </div>
            {renameError && <p className="text-red-400 text-sm mb-3">{renameError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={renameSaving}
                onClick={() => setRenameTarget(null)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameSaving || renameValue.trim() === renameTarget.rsn.trim() || !renameValue.trim()}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {renameSaving ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
