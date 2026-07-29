'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Select from '@/components/Select';
import Input from '@/components/Input';
import ActionMenu, { type ActionItem } from '@/components/ActionMenu';

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
  // 1 = this account is the person's primary (main). Only meaningful when userId is set (a person
  // with one or more linked accounts).
  isPrimary: number;
  userBanned?: boolean;
  // Federation (WIRE §4): the authoritative Discord id + whether it's on the sticky federation
  // denylist. federationBanned members are blocked from re-joining via a broker /exchange (L2).
  effectiveDiscordId?: string | null;
  federationBanned?: boolean;
  provisional: number;
  pendingRole: 'admin' | 'moderator' | null;
}

type FilterMode = 'active' | 'guests' | 'left' | 'linked' | 'unlinked' | 'all';

// How a member landed on the roster — friendlier than the raw source keys.
const SOURCE_LABEL: Record<string, string> = {
  manual: 'Added manually',
  'plugin-self': 'Plugin (self-report)',
  'plugin-roster': 'Clan sync',
};

// Shared badges — used by BOTH the desktop table and the mobile card list so the two
// stay in lockstep. Kept at module scope (pure, member-only) to avoid remount churn.
function AccountBadge({ m }: { m: ClanMember }) {
  return m.userId ? (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light"
      title="Has a site account — this person has signed in with Discord."
    >
      Account
    </span>
  ) : (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-brown-light text-text-muted"
      title="Roster entry only — no site login yet (synced from the clan or added by hand)."
    >
      Roster only
    </span>
  );
}

function StatusBadge({ m }: { m: ClanMember }) {
  if (m.leftAt) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-text-muted/15 text-text-muted">
        Left
      </span>
    );
  }
  if (m.isGuest) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
        Guest
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green-light">
      Member
    </span>
  );
}

function PendingRoleBadge({ m }: { m: ClanMember }) {
  if (!m.pendingRole) return null;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
        m.pendingRole === 'admin' ? 'bg-gold/15 text-gold' : 'bg-blue-500/15 text-blue-400'
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
      {!m.userId ? ' (awaiting claim)' : m.provisional ? ' (awaiting mod approval)' : ' (pending)'}
    </span>
  );
}

export default function ClanRosterClient({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<ClanMember[]>([]);
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
    const [mRes, sRes] = await Promise.all([
      fetch('/api/admin/clan'),
      fetch('/api/admin/settings'),
    ]);
    if (mRes.ok) setMembers(await mRes.json());
    if (sRes.ok) {
      const s = await sRes.json();
      setClanName(s.clan_name || '');
      setClanNameOriginal(s.clan_name || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
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
      // linked/unlinked cut across the current roster (exclude left members) by whether the RSN
      // has a site account (userId).
      if (filter === 'linked' && (m.leftAt || !m.userId)) return false;
      if (filter === 'unlinked' && (m.leftAt || m.userId)) return false;
      if (q && !m.rsn.toLowerCase().includes(q) && !(m.rank || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [members, search, filter]);

  const counts = useMemo(() => {
    let active = 0, guests = 0, left = 0, linked = 0, unlinked = 0;
    for (const m of members) {
      if (m.leftAt) left++;
      else if (m.isGuest) guests++;
      else active++;
      if (!m.leftAt) {
        if (m.userId) linked++;
        else unlinked++;
      }
    }
    return { active, guests, left, linked, unlinked, total: members.length };
  }, [members]);

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

  // Make this account the person's primary (main) — the default representative for per-person events
  // and the name their team takes. Demotes their other accounts server-side.
  async function setPrimary(member: ClanMember) {
    const res = await fetch(`/api/admin/clan/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setPrimary: true }),
    });
    if (res.ok) fetchAll();
  }

  async function removeMember(member: ClanMember) {
    if (!confirm(`Mark ${member.rsn} as left the clan?`)) return;
    const res = await fetch(`/api/admin/clan/${member.id}`, { method: 'DELETE' });
    if (res.ok) fetchAll();
  }

  // Ban/unban the member's linked SITE account — they lose all authenticated access immediately
  // (and are refused on next Discord login). Only meaningful for members with a linked userId.
  async function banUser(member: ClanMember) {
    if (!member.userId) return;
    const banning = !member.userBanned;
    let reason: string | undefined;
    if (banning) {
      const input = prompt(`Ban ${member.rsn}'s site account? They lose all access immediately.\nOptional reason:`);
      if (input === null) return; // cancelled
      reason = input.trim() || undefined;
    } else if (!confirm(`Unban ${member.rsn}'s site account?`)) {
      return;
    }
    const res = await fetch(`/api/admin/users/${member.userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: banning, reason }),
    });
    if (res.ok) fetchAll();
    else alert((await res.json().catch(() => ({}))).error || 'Could not update ban');
  }

  // Federation ban (decision 4, WIRE §4): a sticky denylist keyed on the member's Discord id that
  // blocks a future cross-clan broker /exchange from re-creating them as a guest. Distinct from the
  // site-account "Ban" above (which revokes THIS site's login) — this one travels with the identity.
  async function federationBan(member: ClanMember) {
    if (!member.effectiveDiscordId) return;
    const banning = !member.federationBanned;
    let reason: string | undefined;
    if (banning) {
      const input = prompt(
        `Federation-ban ${member.rsn}? Blocks this Discord identity from re-joining via a broker exchange (cross-clan). Does not touch their current site access.\nOptional reason:`,
      );
      if (input === null) return; // cancelled
      reason = input.trim() || undefined;
    } else if (!confirm(`Lift the federation ban on ${member.rsn}?`)) {
      return;
    }
    const res = banning
      ? await fetch('/api/admin/federation/bans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordId: member.effectiveDiscordId, reason }),
        })
      : await fetch(`/api/admin/federation/bans?discordId=${encodeURIComponent(member.effectiveDiscordId)}`, {
          method: 'DELETE',
        });
    if (res.ok) fetchAll();
    else alert((await res.json().catch(() => ({}))).error || 'Could not update federation ban');
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
        const counts = data.conflictCounts as { players: number; weeklyParticipants: number } | undefined;
        const parts: string[] = [];
        if (counts?.players) parts.push(`${counts.players} player${counts.players === 1 ? '' : 's'}`);
        if (counts?.weeklyParticipants) parts.push(`${counts.weeklyParticipants} weekly entr${counts.weeklyParticipants === 1 ? 'y' : 'ies'}`);
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

  // The per-row actions for an active member, collapsed into one dropdown instead of a button row.
  function buildRowActions(m: ClanMember): ActionItem[] {
    const items: ActionItem[] = [{ label: 'Rename', onClick: () => openRename(m) }];
    if (isAdmin) items.push({ label: 'Set role', onClick: () => openRole(m), variant: 'gold' });
    items.push({
      label: m.isGuest ? 'Promote to member' : 'Demote to guest',
      onClick: () => togglePromote(m),
    });
    // Set-primary only matters for a linked person, and only when this isn't already their main.
    if (m.userId && m.isPrimary !== 1) {
      items.push({
        label: 'Set as main account',
        onClick: () => setPrimary(m),
        title: 'Make this the person’s primary account — the default entry for per-person events',
      });
    }
    items.push({ label: 'Remove from roster', onClick: () => removeMember(m), variant: 'danger' });
    if (isAdmin && m.userId) {
      items.push({
        label: m.userBanned ? 'Unban site account' : 'Ban site account',
        onClick: () => banUser(m),
        variant: m.userBanned ? 'default' : 'danger',
        title: m.userBanned ? 'This site account is banned' : 'Ban this member’s site account',
      });
    }
    if (isAdmin && m.effectiveDiscordId) {
      items.push({
        label: m.federationBanned ? 'Fed unban' : 'Fed ban',
        onClick: () => federationBan(m),
        variant: m.federationBanned ? 'default' : 'danger',
        title: m.federationBanned
          ? 'On the federation denylist — blocked from re-joining via a broker exchange'
          : 'Federation-ban: block this Discord identity from re-joining via a broker exchange (cross-clan)',
      });
    }
    return items;
  }

  const filterDefs: { key: FilterMode; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'guests', label: 'Guests', count: counts.guests },
    { key: 'left', label: 'Left', count: counts.left },
    { key: 'linked', label: 'Has account', count: counts.linked },
    { key: 'unlinked', label: 'Roster only', count: counts.unlinked },
    { key: 'all', label: 'All', count: counts.total },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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
          The plugin&apos;s roster-sync payload must match this clan name. Leave blank to accept any clan.
        </p>
        <div className="flex gap-2 items-start">
          <Input
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

      {/* Filters — a compact dropdown on phones, the full chip row from sm: up. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-4">
        {/* Mobile: combo box */}
        <div className="sm:hidden">
          <Select
            value={filter}
            onChange={(v) => setFilter(v as FilterMode)}
            ariaLabel="Filter roster"
            options={filterDefs.map((f) => ({ value: f.key, label: `${f.label} (${f.count})` }))}
          />
        </div>
        {/* Desktop: chip group */}
        <div className="hidden sm:flex gap-1 border border-card-border rounded-lg p-1 bg-card-bg flex-wrap">
          {filterDefs.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                filter === f.key ? 'bg-gold text-brown-dark font-semibold' : 'text-text-muted hover:text-foreground'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RSN or rank..."
          className="w-full sm:flex-1 sm:max-w-xs px-3 py-1.5 bg-brown-dark border border-card-border rounded text-sm"
        />
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Add Clan Member</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">RSN</label>
                <Input
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
                <Input
                  type="text"
                  value={addDiscord}
                  onChange={(e) => setAddDiscord(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="e.g. 1234567890"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Rank (optional)</label>
                <Input
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
        <>
        {/* Desktop: full table from sm: up. */}
        <div className="hidden sm:block border border-card-border rounded-xl bg-card-bg overflow-x-auto">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{m.rsn}</span>
                      <AccountBadge m={m} />
                    </div>
                    {m.pendingRole && (
                      <div className="mt-1">
                        <PendingRoleBadge m={m} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{m.rank || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge m={m} /></td>
                  <td className="px-4 py-3 text-text-muted text-xs">{SOURCE_LABEL[m.source] ?? m.source}</td>
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
                        <ActionMenu items={buildRowActions(m)} />
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

        {/* Mobile: one card per member (no sideways scroll). */}
        <div className="sm:hidden space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`border border-card-border rounded-xl bg-card-bg p-4 ${m.leftAt ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap font-medium">
                    <span className="break-all">{m.rsn}</span>
                    <AccountBadge m={m} />
                  </div>
                  {m.pendingRole && (
                    <div className="mt-1">
                      <PendingRoleBadge m={m} />
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {m.leftAt ? (
                    <button
                      onClick={() => rejoinMember(m)}
                      className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                    >
                      Rejoin
                    </button>
                  ) : (
                    <ActionMenu items={buildRowActions(m)} />
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div className="min-w-0">
                  <dt className="text-text-muted">Status</dt>
                  <dd className="mt-0.5"><StatusBadge m={m} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-text-muted">Rank</dt>
                  <dd className="mt-0.5 truncate">{m.rank || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-text-muted">Source</dt>
                  <dd className="mt-0.5">{SOURCE_LABEL[m.source] ?? m.source}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-text-muted">Last seen</dt>
                  <dd className="mt-0.5">
                    {m.lastSeenInClan ? new Date(m.lastSeenInClan).toLocaleDateString() : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="border border-card-border rounded-xl bg-card-bg px-4 py-8 text-center text-text-muted">
              No members match this filter.
            </div>
          )}
        </div>
        </>
      )}

      {/* Role-assignment notice */}
      {roleNotice && (
        <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-40 sm:max-w-sm border border-gold/30 bg-card-bg rounded-lg shadow-lg px-4 py-3 text-sm">
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
              <Select
                value={roleValue}
                onChange={(v) => setRoleValue(v as 'admin' | 'moderator' | 'none')}
                ariaLabel="Role"
                options={[
                  { value: 'none', label: 'None (clear)' },
                  { value: 'moderator', label: 'Moderator' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
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
              Updates the RSN everywhere it&apos;s used — active event enrollments, weekly participants,
              and any linked admin plugin token. Submissions and completed events aren&apos;t affected.
            </p>
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">Current RSN</label>
              <div className="px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-text-muted">
                {renameTarget.rsn}
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-text-muted mb-1">New RSN</label>
              <Input
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
