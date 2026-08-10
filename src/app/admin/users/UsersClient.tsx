'use client';

import { useState, useEffect, useMemo } from 'react';
import { avatarUrl } from '@/lib/discord-oauth';
import Select from '@/components/Select';
import Input from '@/components/Input';
import Combobox from '@/components/Combobox';
import ActionMenu, { type ActionItem } from '@/components/ActionMenu';

interface Character {
  id: number;
  rsn: string;
  isGuest: boolean;
  verified: boolean;
  left: boolean;
}

interface User {
  id: number;
  displayName: string;
  role: Role;
  isOwner: boolean;
  banned: boolean;
  createdAt: string;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  lastLoginAt: string | null;
  characters: Character[];
}

type Role = 'admin' | 'treasurer' | 'editor' | 'moderator' | 'member';
type MainFilter = 'staff' | 'members' | 'all';

const ROLE_BADGE_CLS: Record<Role, string> = {
  admin: 'bg-gold/15 text-gold',
  treasurer: 'bg-purple-500/15 text-purple-300',
  editor: 'bg-accent-green/15 text-accent-green-light',
  moderator: 'bg-blue-500/15 text-blue-400',
  member: 'bg-brown-light text-text-muted',
};

// Every role and what it unlocks — surfaced in the dropdown so admins pick by meaning, not by
// memorising which button does what.
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'member', label: 'Member — no admin access' },
  { value: 'moderator', label: 'Moderator — clan + verifications' },
  { value: 'editor', label: 'Editor — edit event tiles' },
  { value: 'treasurer', label: 'Treasurer — moderator + collect fees' },
  { value: 'admin', label: 'Admin — full access' },
];

export default function UsersClient({ currentUserId }: { currentUserId: number | null }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<MainFilter>('all');
  const [search, setSearch] = useState('');
  const [savingRoleId, setSavingRoleId] = useState<number | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null); // user whose add-character input is open
  const [addRsn, setAddRsn] = useState('');
  const [unlinked, setUnlinked] = useState<{ id: number; rsn: string; isGuest: boolean }[]>([]);
  const [charBusy, setCharBusy] = useState(false);
  const [charError, setCharError] = useState('');

  // Rename form (display name only — role is edited inline on the row now).
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Board-editor assignment modal — which events a person may edit tiles on (the per-user side of
  // the per-event Board editors panel). Backed by /api/admin/users/[id]/editor-events.
  const [boardsUser, setBoardsUser] = useState<User | null>(null);
  const [boardsEvents, setBoardsEvents] = useState<{ id: number; name: string }[]>([]);
  const [boardsSel, setBoardsSel] = useState<Set<number>>(new Set());
  const [boardsEditsAll, setBoardsEditsAll] = useState(false);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [boardsSaving, setBoardsSaving] = useState(false);
  const [boardsError, setBoardsError] = useState('');

  async function openBoards(user: User) {
    setBoardsUser(user);
    setBoardsLoading(true);
    setBoardsError('');
    setBoardsEvents([]);
    setBoardsSel(new Set());
    try {
      const res = await fetch(`/api/admin/users/${user.id}/editor-events`);
      if (res.ok) {
        const d = await res.json();
        setBoardsEvents(d.events ?? []);
        setBoardsSel(new Set<number>(d.assignedEventIds ?? []));
        setBoardsEditsAll(!!d.editsAllBoards);
      } else {
        setBoardsError('Could not load boards.');
      }
    } catch {
      setBoardsError('Could not load boards.');
    } finally {
      setBoardsLoading(false);
    }
  }

  function toggleBoard(eventId: number) {
    setBoardsSel((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  async function saveBoards() {
    if (!boardsUser) return;
    setBoardsSaving(true);
    setBoardsError('');
    try {
      const res = await fetch(`/api/admin/users/${boardsUser.id}/editor-events`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: Array.from(boardsSel) }),
      });
      if (res.ok) {
        setBoardsUser(null);
        await fetchUsers();
      } else {
        const d = await res.json().catch(() => ({}));
        setBoardsError(d.error || 'Could not save boards.');
      }
    } catch {
      setBoardsError('Could not save boards.');
    } finally {
      setBoardsSaving(false);
    }
  }

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.people ?? []);
      setUnlinked(data.unlinked ?? []);
    }
    setLoading(false);
  }

  async function banUser(user: User) {
    const banning = !user.banned;
    let reason: string | undefined;
    if (banning) {
      const input = prompt(`Ban ${user.displayName}? They lose all site access immediately.\nOptional reason:`);
      if (input === null) return;
      reason = input.trim() || undefined;
    } else if (!confirm(`Unban ${user.displayName}?`)) {
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: banning, reason }),
    });
    if (res.ok) fetchUsers();
    else alert((await res.json().catch(() => ({}))).error || 'Could not update ban');
  }

  async function addCharacter(user: User) {
    const rsn = addRsn.trim();
    if (!rsn) return;
    setCharBusy(true);
    setCharError('');
    const res = await fetch(`/api/admin/users/${user.id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsn }),
    });
    setCharBusy(false);
    if (res.ok) {
      setAddingTo(null);
      setAddRsn('');
      fetchUsers();
    } else {
      setCharError((await res.json().catch(() => ({}))).error || 'Could not add character');
    }
  }

  async function removeCharacter(user: User, char: Character) {
    if (!confirm(`Remove ${char.rsn} from ${user.displayName}?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}/characters/${char.id}`, { method: 'DELETE' });
    if (res.ok) fetchUsers();
    else alert((await res.json().catch(() => ({}))).error || 'Could not remove character');
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void fetchUsers();
  }, []);

  const counts = useMemo(() => {
    const staff = users.filter((u) => u.role !== 'member').length;
    return { staff, members: users.length - staff };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'staff' && u.role === 'member') return false;
      if (filter === 'members' && u.role !== 'member') return false;
      if (!q) return true;
      return `${u.displayName} ${u.discordUsername ?? ''}`.toLowerCase().includes(q);
    });
  }, [users, filter, search]);

  const viewerIsOwner = useMemo(
    () => users.some((u) => u.isOwner && u.id === currentUserId),
    [users, currentUserId],
  );

  async function changeRole(user: User, role: Role) {
    if (user.role === role) return;
    setSavingRoleId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to update role');
    }
    await fetchUsers();
    setSavingRoleId(null);
  }

  async function handleTransferOwnership(user: User) {
    if (
      !confirm(
        `Transfer ownership to "${user.displayName}"?\n\nThey become the protected owner and you become a regular admin. Only they can transfer it back.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}/transfer-ownership`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to transfer ownership');
      return;
    }
    fetchUsers();
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    setSaving(true);
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: editDisplayName }),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || 'Failed to update user');
      setSaving(false);
      return;
    }
    setEditingUser(null);
    setSaving(false);
    fetchUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete "${user.displayName}"? This removes their site account.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete user');
      return;
    }
    fetchUsers();
  }

  if (loading) {
    return <div className="text-center py-12 text-text-muted">Loading accounts…</div>;
  }

  const FILTERS: { key: MainFilter; label: string; count?: number }[] = [
    { key: 'staff', label: 'Staff', count: counts.staff },
    { key: 'members', label: 'Members', count: counts.members },
    { key: 'all', label: 'All accounts', count: users.length },
  ];

  // Row actions for a non-owner account, collapsed into one dropdown.
  function buildUserActions(user: User): ActionItem[] {
    const items: ActionItem[] = [];
    if (viewerIsOwner && user.role === 'admin') {
      items.push({
        label: 'Make owner',
        onClick: () => handleTransferOwnership(user),
        variant: 'gold',
        title: 'Transfer ownership to this admin',
      });
    }
    items.push({ label: 'Rename', onClick: () => startEdit(user) });
    // Board editing is a per-event grant; admins already edit every board, so skip it for them.
    if (user.role !== 'admin') {
      items.push({ label: 'Boards…', onClick: () => openBoards(user), title: 'Choose which event boards this person can edit' });
    }
    items.push({
      label: user.banned ? 'Unban' : 'Ban',
      onClick: () => banUser(user),
      variant: user.banned ? 'default' : 'danger',
    });
    items.push({ label: 'Delete', onClick: () => handleDelete(user), variant: 'danger' });
    return items;
  }

  // Shared cell renderers — used by BOTH the desktop table and the mobile card list so the two
  // surfaces render identical content (avatar/characters, role control, row actions).
  const renderPerson = (user: User) => {
    const avatar = user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null;
    return (
      <div className="flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" width={32} height={32} className="rounded-full shrink-0" />
        ) : (
          <span className="w-8 h-8 shrink-0 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs font-semibold">
            {(user.displayName || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="font-medium truncate flex items-center gap-2">
            {user.displayName}
            {user.banned && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 shrink-0">Banned</span>
            )}
          </div>
          <div className="text-xs text-text-muted truncate">
            {user.discordUsername ? `@${user.discordUsername}` : '—'}
          </div>
          {/* Characters — the game accounts this person owns. */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {user.characters.map((c) => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border ${
                  c.left
                    ? 'border-card-border text-text-muted/60'
                    : c.verified
                      ? 'border-accent-green/30 text-accent-green-light'
                      : 'border-card-border text-text-muted'
                }`}
                title={`${c.isGuest ? 'Guest' : 'Member'}${c.verified ? ' · verified' : ''}${c.left ? ' · left clan' : ''}`}
              >
                {c.rsn}
                <button
                  onClick={() => removeCharacter(user, c)}
                  className="text-red-400/70 hover:text-red-300 leading-none"
                  title="Remove character"
                  aria-label={`Remove ${c.rsn}`}
                >
                  ×
                </button>
              </span>
            ))}
            {addingTo === user.id ? (
              <span className="inline-flex items-center gap-1">
                <Combobox
                  value={addRsn}
                  onChange={setAddRsn}
                  suggestions={unlinked.map((u) => u.rsn)}
                  placeholder="Pick a roster/guest account or type an RSN"
                  ariaLabel="Character RSN"
                  className="w-64 max-w-[60vw]"
                />
                <button onClick={() => addCharacter(user)} disabled={charBusy} className="text-[11px] text-gold disabled:opacity-50">
                  {charBusy ? '…' : 'Add'}
                </button>
                <button onClick={() => { setAddingTo(null); setAddRsn(''); setCharError(''); }} className="text-[11px] text-text-muted">✕</button>
              </span>
            ) : (
              <button
                onClick={() => { setAddingTo(user.id); setAddRsn(''); setCharError(''); }}
                className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-card-border text-text-muted hover:border-gold/40 hover:text-gold transition-colors"
              >
                + character
              </button>
            )}
            {addingTo === user.id && charError && <span className="text-[11px] text-red-400 w-full">{charError}</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderRoleControl = (user: User) =>
    user.isOwner ? (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/25 text-gold border border-gold/40"
          title="Clan owner — provisioned this instance. Cannot be demoted or removed."
        >
          👑 Owner
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE_CLS[user.role]}`}>
          {user.role}
        </span>
      </span>
    ) : (
      <div className="max-w-[15rem]">
        <Select
          value={user.role}
          onChange={(v) => changeRole(user, v as Role)}
          disabled={savingRoleId === user.id}
          ariaLabel={`Role for ${user.displayName}`}
          options={ROLE_OPTIONS}
        />
      </div>
    );

  const renderActionsControl = (user: User) =>
    user.isOwner ? (
      <span className="text-xs text-text-muted italic whitespace-nowrap" title="The owner cannot be demoted or removed. Transfer ownership to hand it off.">
        🔒 Protected
      </span>
    ) : (
      <div className="flex justify-end">
        <ActionMenu items={buildUserActions(user)} />
      </div>
    );

  const emptyMessage =
    filter === 'staff'
      ? 'No staff yet — switch to Members or All accounts and pick someone a role.'
      : 'No accounts match.';

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-1 h-5 bg-gold rounded-full" />
          People
        </h2>
        <p className="text-text-muted text-sm mt-1">
          One row per <span className="text-foreground/80">person</span> (their Discord site account) with
          the RuneScape <span className="text-foreground/80">characters</span> they own. Set a staff role,
          add or remove characters, and ban anyone who shouldn&rsquo;t have access. Everyone who signs in
          with Discord starts as a plain Member.
        </p>
      </div>

      {/* Filter — a combo box on phones, the segmented control from sm: up. Leads with Staff so the
          tab reads as being about staff, not every login. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-4">
        {/* Mobile: combo box */}
        <div className="sm:hidden">
          <Select
            value={filter}
            onChange={(v) => setFilter(v as MainFilter)}
            ariaLabel="Filter people"
            options={FILTERS.map((f) => ({
              value: f.key,
              label: f.count != null ? `${f.label} (${f.count})` : f.label,
            }))}
          />
        </div>
        {/* Desktop: segmented control */}
        <div className="hidden sm:inline-flex rounded-lg border border-card-border overflow-hidden">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                filter === f.key ? 'bg-gold/20 text-gold' : 'text-text-muted hover:text-foreground hover:bg-brown-light'
              }`}
            >
              {f.label}
              {f.count != null && <span className="ml-1.5 opacity-60">{f.count}</span>}
            </button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full sm:ml-auto sm:w-52"
        />
      </div>

      {/* Rename modal */}
      {editingUser && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h3 className="font-semibold mb-4">Rename: {editingUser.displayName}</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Display name</label>
              <Input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
            </div>
            {editError && <p className="text-red-400 text-sm">{editError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {boardsUser && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h3 className="font-semibold mb-1">Board editing: {boardsUser.displayName}</h3>
          <p className="text-sm text-text-muted mb-4">
            Tick the boards this person may build and edit tiles on. Granting a board to a regular
            member gives them just enough access to reach that board&apos;s Tiles tab.
          </p>
          {boardsLoading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : boardsEditsAll ? (
            <p className="text-sm rounded-lg border border-accent-green/30 bg-accent-green/10 text-accent-green-light px-3 py-2 mb-4">
              This person already edits <span className="font-semibold">every board</span> (
              {boardsUser.role === 'admin' ? 'admin' : 'global Editor role'}). To scope them to specific
              boards, first set their role to Member, then grant boards here.
            </p>
          ) : boardsEvents.length === 0 ? (
            <p className="text-sm text-text-muted mb-4">No events exist yet.</p>
          ) : (
            <ul className="mb-4 max-h-72 overflow-y-auto divide-y divide-card-border/50 border border-card-border rounded-lg">
              {boardsEvents.map((ev) => (
                <li key={ev.id}>
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-card-bg-hover transition-colors">
                    <input
                      type="checkbox"
                      checked={boardsSel.has(ev.id)}
                      onChange={() => toggleBoard(ev.id)}
                      className="accent-gold w-4 h-4"
                    />
                    <span className="text-sm text-foreground truncate">{ev.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {boardsError && <p className="text-red-400 text-sm mb-3">{boardsError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setBoardsUser(null)}
              className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveBoards}
              disabled={boardsSaving || boardsLoading || boardsEditsAll}
              className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-gold-light text-brown-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {boardsSaving ? 'Saving…' : 'Save boards'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop: table from sm: up. */}
      <div className="hidden sm:block border border-card-border rounded-xl bg-card-bg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-card-border/50 hover:bg-card-bg-hover transition-colors">
                <td className="px-4 py-3">{renderPerson(user)}</td>
                <td className="px-4 py-3">{renderRoleControl(user)}</td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : `joined ${new Date(user.createdAt).toLocaleDateString()}`}
                </td>
                <td className="px-4 py-3 text-right">{renderActionsControl(user)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per person (no sideways scroll). */}
      <div className="sm:hidden space-y-3">
        {filtered.map((user) => (
          <div key={user.id} className="border border-card-border rounded-xl bg-card-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{renderPerson(user)}</div>
              <div className="shrink-0">{renderActionsControl(user)}</div>
            </div>
            <div className="mt-3 space-y-3 border-t border-card-border/60 pt-3">
              <div className="min-w-0">
                <div className="text-xs text-text-muted mb-1">Role</div>
                {renderRoleControl(user)}
              </div>
              <div className="text-xs text-text-muted">
                {user.lastLoginAt
                  ? `Last login ${new Date(user.lastLoginAt).toLocaleDateString()}`
                  : `Joined ${new Date(user.createdAt).toLocaleDateString()}`}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="border border-card-border rounded-xl bg-card-bg px-4 py-8 text-center text-text-muted">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
