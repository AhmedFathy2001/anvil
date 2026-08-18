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
  source: 'roster' | 'admin' | 'application';
  joinedAt: string;
  leftAt: string | null;
  lastSeenInClan: string | null;
  // Only ever written by the plugin's stat push, which happens while the member is in game — so
  // unlike lastSeenInClan this really does mean "played". Null for anyone without the plugin.
  liveStatsAt: string | null;
  notes: string | null;
  userId: number | null;
  // 1 = this account is the person's primary (main). Only meaningful when userId is set (a person
  // with one or more linked accounts).
  isPrimary: number;
  userBanned?: boolean;
  // Live site role of the linked account ('admin' | 'treasurer' | 'moderator' | 'editor' |
  // 'member'), null when the RSN has no site login yet. Drives the role filter.
  userRole?: string | null;
  // Authoritative Discord id for the member (users.discordId beats the legacy column).
  effectiveDiscordId?: string | null;
  provisional: number;
  pendingRole: PendingRole | null;
}

// Staff roles that can be pre-assigned to a roster member (applied when they verify). Mirrors the
// Users page staff roles so both "Set role" surfaces offer the same tiers. 'none' clears it.
type PendingRole = 'admin' | 'moderator' | 'editor' | 'treasurer';
type PendingRoleValue = PendingRole | 'none';

type FilterMode = 'active' | 'review' | 'quiet' | 'guests' | 'left' | 'linked' | 'unlinked' | 'all';

const QUIET_DAYS = 7;

/**
 * Days since the member last PLAYED.
 *
 * Deliberately not lastSeenInClan: clan-sync bumps that column for every member of the roster on
 * every sync, so it answers "are they still in the clan" and reads as today for everyone — as a
 * "last seen" column it showed the same value on all 135 rows. liveStatsAt is written only by the
 * plugin's stat push, which happens while someone is actually in game.
 *
 * Null means no plugin data at all, which is a different thing from being inactive and must not be
 * counted as either.
 */
function daysSincePlayed(m: { liveStatsAt: string | null }, now: number): number | null {
  if (!m.liveStatsAt) return null;
  const ms = Date.parse(m.liveStatsAt);
  return Number.isFinite(ms) ? Math.floor((now - ms) / 86_400_000) : null;
}

// Site roles a member can hold (or be queued for). 'staff' is the catch-all — anything above a
// plain member — because "show me everyone with power" is the question staff actually ask.
const ROLE_FILTERS = [
  { value: 'staff', label: 'Any staff' },
  { value: 'admin', label: 'Admin' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'editor', label: 'Editor' },
  { value: 'member', label: 'Member (no staff role)' },
  { value: 'none', label: 'No site account' },
] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number]['value'] | 'any';

const STAFF_ROLES = new Set(['admin', 'treasurer', 'moderator', 'editor']);

// A member matches a role filter on either their LIVE role or a queued (pending) one — a pre-assigned
// admin is who you're looking for when you filter by admin, even before they've claimed their RSN.
function matchesRole(m: ClanMember, filter: RoleFilter): boolean {
  if (filter === 'any') return true;
  const live = m.userRole ?? null;
  const pending = m.pendingRole ?? null;
  if (filter === 'none') return !m.userId;
  if (filter === 'staff') return STAFF_ROLES.has(live || '') || STAFF_ROLES.has(pending || '');
  if (filter === 'member') return !!m.userId && !STAFF_ROLES.has(live || '') && !pending;
  return live === filter || pending === filter;
}

// How a member landed on the roster — friendlier than the raw source keys.
const SOURCE_LABEL: Record<string, string> = {
  admin: 'Added manually',
  application: 'Applied or self-reported',
  roster: 'Clan sync',
};

// Shared badges — used by BOTH the desktop table and the mobile card list so the two
// stay in lockstep. Kept at module scope (pure, member-only) to avoid remount churn.
/**
 * Who is on the roster, as one bar.
 *
 * "135 members · 45 guests · 69 departed" was three numbers with no relationship to each other.
 * The same figures as proportions of one bar show the shape of the clan at a glance — and every
 * segment is the filter for itself.
 */
function Composition({
  counts,
  onPick,
}: {
  counts: {
    active: number;
    guests: number;
    left: number;
    linked: number;
    unlinked: number;
    review: number;
    quiet: number;
    staff: number;
    noPluginData: number;
    total: number;
  };
  onPick: (f: FilterMode) => void;
}) {
  const segments: { key: FilterMode; label: string; count: number; bar: string; dot: string }[] = [
    { key: 'active', label: 'Members', count: counts.active, bar: 'bg-accent-green', dot: 'bg-accent-green' },
    { key: 'guests', label: 'Guests', count: counts.guests, bar: 'bg-blue-500', dot: 'bg-blue-500' },
    { key: 'left', label: 'Departed', count: counts.left, bar: 'bg-card-border', dot: 'bg-card-border' },
  ];
  const total = segments.reduce((n, s) => n + s.count, 0);

  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3 mb-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">
          Who is on the roster
        </div>
        <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden mt-2 bg-brown-dark">
          {total === 0 ? (
            <span className="flex-1 bg-brown-light" />
          ) : (
            segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <button
                  key={s.key}
                  onClick={() => onPick(s.key)}
                  title={`${s.label}: ${s.count}`}
                  aria-label={`Show ${s.label}`}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  className={`${s.bar} hover:brightness-125 transition-[filter]`}
                />
              ))
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-text-muted">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => onPick(s.key)}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <span className={`w-2 h-2 rounded-sm ${s.dot}`} />
              {s.label}
              <span className="tabular-nums text-foreground font-semibold">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-1.5">
        {counts.review > 0 && (
          <button
            onClick={() => onPick('review')}
            className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors whitespace-nowrap"
          >
            {counts.review} waiting on review
          </button>
        )}
        <span className="text-[11px] text-text-muted tabular-nums">
          {counts.linked} linked · {counts.quiet} quiet {QUIET_DAYS}d+ · {counts.noPluginData} no plugin data
        </span>
      </div>
    </div>
  );
}

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

/**
 * How long ago the member last played, as an age rather than a date.
 *
 * This column used to show lastSeenInClan, which clan-sync bumps for the whole roster at once — so
 * every row read the same value and the column carried no information at all. It now reads the
 * plugin's stat push, and says plainly when there is no plugin data rather than implying absence.
 */
function LastPlayed({
  m,
  now,
}: {
  m: { liveStatsAt: string | null; lastSeenInClan: string | null };
  now: number;
}) {
  const days = daysSincePlayed(m, now);
  if (days === null) {
    return (
      <span
        className="text-text-muted/50"
        title={
          m.lastSeenInClan
            ? `No plugin data. Last roster sync: ${new Date(m.lastSeenInClan).toLocaleString()}`
            : 'No plugin data.'
        }
      >
        no plugin data
      </span>
    );
  }

  const tone = days >= 30 ? 'bg-accent-red' : days >= QUIET_DAYS ? 'bg-yellow-500' : 'bg-accent-green';
  const label =
    days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;

  return (
    <span
      className="inline-flex items-center gap-2 text-text-muted tabular-nums"
      title={m.liveStatsAt ? `Last played ${new Date(m.liveStatsAt).toLocaleString()}` : undefined}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone}`} />
      {label}
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
  // One reading of the clock for the page's lifetime, so "6d ago" and the Idle view can never
  // disagree with each other across a re-render.
  const [nowMs] = useState(() => Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('active');
  // Secondary filters, applied on top of the status chips: in-game rank + site role.
  const [rankFilter, setRankFilter] = useState<string>('any');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('any');

  // Bulk selection — ids only, so a refetch keeps whatever is still on screen selected.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkRole, setBulkRole] = useState<PendingRoleValue>('moderator');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addRsn, setAddRsn] = useState('');
  const [addDiscord, setAddDiscord] = useState('');
  const [addRank, setAddRank] = useState('');
  const [addIsGuest, setAddIsGuest] = useState(false);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const [roleTarget, setRoleTarget] = useState<ClanMember | null>(null);
  const [roleValue, setRoleValue] = useState<PendingRoleValue>('none');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  // Clan naming — two independent values. `clanName` is the display name (site, plugin, Discord);
  // `inGameClanName` is the exact OSRS clan name the roster sync must report (blank = accept any).
  const [clanName, setClanName] = useState('');
  const [inGameClanName, setInGameClanName] = useState('');
  const [clanNameOriginal, setClanNameOriginal] = useState('');
  const [inGameNameOriginal, setInGameNameOriginal] = useState('');
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
      setInGameClanName(s.clan_ingame_name || '');
      setInGameNameOriginal(s.clan_ingame_name || '');
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
      body: JSON.stringify({ clan_name: clanName, clan_ingame_name: inGameClanName }),
    });
    if (res.ok) {
      setClanNameOriginal(clanName);
      setInGameNameOriginal(inGameClanName);
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
      // Everyone the plugin reported but no mod has confirmed yet — the queue this page exists
      // to clear, previously only reachable from another route entirely.
      if (filter === 'review' && (m.leftAt || !m.provisional)) return false;
      // "Quiet", not "idle": someone who has never run the plugin isn't inactive, we simply have
      // no evidence either way, so they belong in neither bucket.
      if (filter === 'quiet') {
        if (m.leftAt || m.isGuest) return false;
        const days = daysSincePlayed(m, nowMs);
        if (days === null || days < QUIET_DAYS) return false;
      }
      if (filter === 'guests' && (!m.isGuest || m.leftAt)) return false;
      if (filter === 'left' && !m.leftAt) return false;
      // linked/unlinked cut across the current roster (exclude left members) by whether the RSN
      // has a site account (userId).
      if (filter === 'linked' && (m.leftAt || !m.userId)) return false;
      if (filter === 'unlinked' && (m.leftAt || m.userId)) return false;
      if (q && !m.rsn.toLowerCase().includes(q) && !(m.rank || '').toLowerCase().includes(q)) {
        return false;
      }
      if (rankFilter !== 'any') {
        const rank = (m.rank || '').trim();
        if (rankFilter === 'none' ? !!rank : rank.toLowerCase() !== rankFilter.toLowerCase()) return false;
      }
      if (!matchesRole(m, roleFilter)) return false;
      return true;
    });
  }, [members, search, filter, rankFilter, roleFilter, nowMs]);

  // Rank options come from the roster itself — in-game ranks are free text pushed by the plugin,
  // so there's no fixed list to hardcode. Counted over the status-filtered set the chips describe.
  const rankOptions = useMemo(() => {
    const counts = new Map<string, number>();
    let unranked = 0;
    for (const m of members) {
      const rank = (m.rank || '').trim();
      if (!rank) {
        unranked++;
        continue;
      }
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
    const opts = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([rank, n]) => ({ value: rank, label: `${rank} (${n})` }));
    return [
      { value: 'any', label: 'Any rank' },
      ...opts,
      ...(unranked ? [{ value: 'none', label: `No rank (${unranked})` }] : []),
    ];
  }, [members]);

  const counts = useMemo(() => {
    let active = 0, guests = 0, left = 0, linked = 0, unlinked = 0, review = 0, quiet = 0, staff = 0, noPluginData = 0;
    for (const m of members) {
      if (m.leftAt) left++;
      else if (m.isGuest) guests++;
      else active++;
      if (!m.leftAt) {
        if (m.userId) linked++;
        else unlinked++;
        if (m.provisional) review++;
        if (STAFF_ROLES.has(m.userRole ?? '')) staff++;
        if (!m.isGuest) {
          const days = daysSincePlayed(m, nowMs);
          if (days === null) noPluginData++;
          else if (days >= QUIET_DAYS) quiet++;
        }
      }
    }
    return { active, guests, left, linked, unlinked, review, quiet, staff, noPluginData, total: members.length };
  }, [members, nowMs]);

  // ── Bulk selection ────────────────────────────────────────────────────────
  // Selection is by id and survives filter changes, so you can stage a few names from one filter,
  // switch to another, add more, then apply once.
  const selectedCount = selected.size;
  const visibleIds = useMemo(() => filtered.map((m) => m.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkNotice(null);
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
    setBulkNotice(null);
  }

  // Every bulk action goes through one endpoint (POST /api/admin/clan/bulk), which re-applies the
  // same guards the per-row routes do and reports per-member skips instead of failing the batch.
  async function runBulk() {
    if (!bulkAction || selectedCount === 0) return;
    const ids = [...selected];
    const n = ids.length;
    const role = bulkRole === 'none' ? null : bulkRole;

    const confirmText: Record<string, string> = {
      remove: `Mark ${n} member${n === 1 ? '' : 's'} as left the clan?`,
      ban: `Ban the site accounts of ${n} selected member${n === 1 ? '' : 's'}? They lose all access immediately.`,
      demote: `Demote ${n} member${n === 1 ? '' : 's'} to guest?`,
    };
    if (confirmText[bulkAction] && !confirm(confirmText[bulkAction])) return;

    let reason: string | undefined;
    if (bulkAction === 'ban') {
      const input = prompt(`Optional reason for banning ${n} account${n === 1 ? '' : 's'}:`);
      if (input === null) return; // cancelled
      reason = input.trim() || undefined;
    }

    setBulkBusy(true);
    setBulkNotice(null);
    const res = await fetch('/api/admin/clan/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action: bulkAction, role, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) {
      setBulkNotice({ type: 'err', text: data.error || 'Bulk action failed' });
      return;
    }

    const parts = [`${data.applied} member${data.applied === 1 ? '' : 's'} updated`];
    if (bulkAction === 'set-role' && role) {
      parts.push(
        data.appliedNow
          ? `${data.appliedNow} promoted immediately, the rest apply on verification`
          : 'applies when they verify via Discord',
      );
    }
    const skipped: { rsn: string; reason: string }[] = data.skipped ?? [];
    if (skipped.length) {
      const shown = skipped.slice(0, 3).map((sk) => `${sk.rsn} (${sk.reason})`).join(', ');
      parts.push(`${skipped.length} skipped: ${shown}${skipped.length > 3 ? '…' : ''}`);
    }
    setBulkNotice({ type: 'ok', text: `${parts.join(' · ')}.` });
    setSelected(new Set());
    fetchAll();
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
      body: JSON.stringify({ isGuest: !member.isGuest }),
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
    return items;
  }

  // Ordered by how often staff actually need them, with the queue that wants a decision first.
  const filterDefs: { key: FilterMode; label: string; count: number; attn?: boolean }[] = [
    { key: 'review', label: 'Needs review', count: counts.review, attn: true },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'quiet', label: `Quiet ${QUIET_DAYS}d+`, count: counts.quiet },
    { key: 'guests', label: 'Guests', count: counts.guests },
    { key: 'unlinked', label: 'Roster only', count: counts.unlinked },
    { key: 'linked', label: 'Has account', count: counts.linked },
    { key: 'left', label: 'Departed', count: counts.left },
    { key: 'all', label: 'All', count: counts.total },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        {/* No second <h1>: the hub layout already titles the page "Clan" and the tab above says
            "Members". "Clan / Clan Roster" was the same word twice before you reached a member.
            Identity is a line, not a form — the names change about once a year; the roster is read
            every day, and the settings card used to sit on top of it regardless. */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="inline-flex items-center gap-2 border border-card-border rounded-full bg-card-bg px-3 py-1">
              <span className="font-semibold">{clanName || 'Unnamed clan'}</span>
              {inGameClanName && inGameClanName !== clanName && (
                <span className="text-[11px] text-text-muted">in-game: {inGameClanName}</span>
              )}
            </span>
            <button
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="text-xs text-gold hover:text-gold-light underline underline-offset-2"
            >
              {showSettings ? 'Hide clan settings' : 'Edit clan settings'}
            </button>
          </div>
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

      {/* Who is on the roster — the shape of it, before the 249 rows of it. */}
      <Composition counts={counts} onPick={setFilter} />

      {/* Clan settings — folded away by default; see the header disclosure. */}
      <div className={`border border-card-border rounded-xl bg-card-bg p-5 mb-6 ${showSettings ? '' : 'hidden'}`}>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <span className="w-1 h-5 bg-gold rounded-full" />
          Clan Settings
        </h2>
        <p className="text-text-muted text-sm mb-4">
          Your display name and your in-game clan name can differ — the site shows one, the plugin
          matches the other.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">Display name</label>
            <Input
              type="text"
              value={clanName}
              onChange={(e) => {
                setClanName(e.target.value);
                setClanNameMessage(null);
              }}
              placeholder="e.g. The Golden Arrows"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
            />
            <p className="text-[11px] text-text-muted mt-1">
              What the site, the plugin and Discord posts call your clan.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">In-game clan name</label>
            <Input
              type="text"
              value={inGameClanName}
              onChange={(e) => {
                setInGameClanName(e.target.value);
                setClanNameMessage(null);
              }}
              placeholder="e.g. Golden Arrows CC"
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
            />
            <p className="text-[11px] text-text-muted mt-1">
              The plugin&apos;s roster-sync payload must match this exactly. Leave blank to accept a
              sync from any clan.
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={saveClanName}
            disabled={
              clanNameSaving ||
              (clanName === clanNameOriginal && inGameClanName === inGameNameOriginal)
            }
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
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
          <Select
            value={rankFilter}
            onChange={setRankFilter}
            ariaLabel="Filter by in-game rank"
            options={rankOptions}
          />
          <Select
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as RoleFilter)}
            ariaLabel="Filter by site role"
            options={[
              { value: 'any', label: 'Any role' },
              ...ROLE_FILTERS.map((r) => ({ value: r.value, label: r.label })),
            ]}
          />
          {(rankFilter !== 'any' || roleFilter !== 'any') && (
            <button
              onClick={() => {
                setRankFilter('any');
                setRoleFilter('any');
              }}
              className="px-2 py-1.5 text-xs text-text-muted hover:text-foreground underline decoration-dotted self-start sm:self-auto"
            >
              Clear
            </button>
          )}
        </div>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search RSN or rank..."
          className="w-full sm:flex-1 sm:max-w-xs px-3 py-1.5 bg-brown-dark border border-card-border rounded text-sm"
        />
      </div>

      {/* Bulk actions — admin-only (the endpoint is too). Appears as soon as anything is ticked. */}
      {isAdmin && (selectedCount > 0 || bulkNotice) && (
        <div className="border border-gold/30 rounded-xl bg-gold/5 px-4 py-3 mb-4">
          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gold">
                {selectedCount} selected
              </span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-text-muted hover:text-foreground underline decoration-dotted"
              >
                Clear
              </button>
              <span className="mx-1 h-4 w-px bg-card-border" aria-hidden />
              <Select
                value={bulkAction}
                onChange={(v) => {
                  setBulkAction(v);
                  setBulkNotice(null);
                }}
                ariaLabel="Bulk action"
                options={[
                  { value: '', label: 'Choose an action…' },
                  { value: 'set-role', label: 'Set staff role' },
                  { value: 'promote', label: 'Promote to member' },
                  { value: 'demote', label: 'Demote to guest' },
                  { value: 'rejoin', label: 'Re-add to roster' },
                  { value: 'remove', label: 'Remove from roster' },
                  { value: 'ban', label: 'Ban site accounts' },
                  { value: 'unban', label: 'Unban site accounts' },
                ]}
              />
              {bulkAction === 'set-role' && (
                <Select
                  value={bulkRole}
                  onChange={(v) => setBulkRole(v as PendingRoleValue)}
                  ariaLabel="Role to assign"
                  options={[
                    { value: 'moderator', label: 'Moderator' },
                    { value: 'treasurer', label: 'Treasurer' },
                    { value: 'editor', label: 'Editor' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'none', label: 'Clear pending role' },
                  ]}
                />
              )}
              <button
                onClick={runBulk}
                disabled={!bulkAction || bulkBusy}
                className="px-4 py-1.5 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {bulkBusy ? 'Applying…' : 'Apply'}
              </button>
            </div>
          )}
          {bulkNotice && (
            <p
              className={`text-xs ${selectedCount > 0 ? 'mt-2' : ''} ${
                bulkNotice.type === 'ok' ? 'text-accent-green-light' : 'text-red-400'
              }`}
            >
              {bulkNotice.text}
            </p>
          )}
        </div>
      )}

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
                {isAdmin && (
                  <th className="pl-4 pr-0 py-3 w-8">
                    <input
                      type="checkbox"
                      className="w-4 h-4 align-middle"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all shown members"
                      title="Select everything matching the current filters"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">RSN</th>
                <th className="px-4 py-3 font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Last played</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-card-border/50 hover:bg-card-bg-hover transition-colors ${m.leftAt ? 'opacity-60' : ''}`}
                >
                  {isAdmin && (
                    <td className="pl-4 pr-0 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 align-middle"
                        checked={selected.has(m.id)}
                        onChange={() => toggleOne(m.id)}
                        aria-label={`Select ${m.rsn}`}
                      />
                    </td>
                  )}
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
                  <td className="px-4 py-3 text-xs">
                    <LastPlayed m={m} now={nowMs} />
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
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-muted">
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
                    {isAdmin && (
                      <input
                        type="checkbox"
                        className="w-4 h-4 shrink-0"
                        checked={selected.has(m.id)}
                        onChange={() => toggleOne(m.id)}
                        aria-label={`Select ${m.rsn}`}
                      />
                    )}
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
                  <dt className="text-text-muted">Last played</dt>
                  <dd className="mt-0.5">
                    <LastPlayed m={m} now={nowMs} />
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
                onChange={(v) => setRoleValue(v as PendingRoleValue)}
                ariaLabel="Role"
                options={[
                  { value: 'none', label: 'None (clear)' },
                  { value: 'moderator', label: 'Moderator — clan + verifications' },
                  { value: 'editor', label: 'Editor — edit event tiles' },
                  { value: 'treasurer', label: 'Treasurer — moderator + collect fees' },
                  { value: 'admin', label: 'Admin — full access' },
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
