'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { avatarUrl } from '@/lib/discord-oauth';
import Select from '@/components/Select';
import Input from '@/components/Input';

interface User {
  id: number;
  displayName: string;
  role: Role;
  isOwner: boolean;
  createdAt: string;
  discordId: string | null;
  discordUsername: string | null;
  discordAvatar: string | null;
  lastLoginAt: string | null;
}

type Role = 'admin' | 'treasurer' | 'editor' | 'moderator' | 'member';
type RoleFilter = 'all' | Role;

const ROLE_BADGE_CLS: Record<Role, string> = {
  admin: 'bg-gold/15 text-gold',
  treasurer: 'bg-purple-500/15 text-purple-300',
  editor: 'bg-accent-green/15 text-accent-green-light',
  moderator: 'bg-blue-500/15 text-blue-400',
  member: 'bg-brown-light text-text-muted',
};

export default function UsersClient({ currentUserId }: { currentUserId: number | null }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');

  // Edit form
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<Role>('member');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch; cascading re-renders aren't a concern here
    void fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== 'all' && u.role !== filter) return false;
      if (!q) return true;
      const haystack = `${u.displayName} ${u.discordUsername ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [users, filter, search]);

  const counts = useMemo(() => {
    return {
      admin: users.filter((u) => u.role === 'admin').length,
      treasurer: users.filter((u) => u.role === 'treasurer').length,
      editor: users.filter((u) => u.role === 'editor').length,
      moderator: users.filter((u) => u.role === 'moderator').length,
      member: users.filter((u) => u.role === 'member').length,
    };
  }, [users]);

  // Is the person viewing this page the protected owner? Only they see the transfer-ownership action.
  const viewerIsOwner = useMemo(
    () => users.some((u) => u.isOwner && u.id === currentUserId),
    [users, currentUserId]
  );

  async function handleTransferOwnership(user: User) {
    if (
      !confirm(
        `Transfer ownership to "${user.displayName}"?\n\nThey will become the protected owner and you will become a regular admin. Only they will be able to transfer it back.`
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
    setEditRole(user.role);
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    setSaving(true);

    const body: Record<string, string> = {};
    if (editDisplayName !== editingUser.displayName) body.displayName = editDisplayName;
    if (editRole !== editingUser.role) body.role = editRole;

    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

  async function quickPromote(user: User, role: Role) {
    if (user.role === role) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to update role');
      return;
    }
    fetchUsers();
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.displayName}"?`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete user');
      return;
    }
    fetchUsers();
  }

  if (loading) {
    return <div className="text-center py-12 text-text-muted">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gold">User Management</h1>
          <p className="text-text-muted text-sm mt-1">
            {users.length} total · {counts.admin} admin · {counts.treasurer} treasurer · {counts.editor} editor · {counts.moderator} moderator · {counts.member} member
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'admin', 'treasurer', 'editor', 'moderator', 'member'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors capitalize ${
              filter === r
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'border border-card-border text-text-muted hover:text-foreground hover:bg-brown-light'
            }`}
          >
            {r === 'all' ? 'All' : r}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="ml-auto bg-brown-light border border-card-border rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-gold"
        />
      </div>

      {/* Edit modal */}
      {editingUser && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Edit: {editingUser.displayName}</h2>
          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Display Name</label>
              <Input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Role</label>
              <Select
                value={editRole}
                onChange={(v) => setEditRole(v as Role)}
                ariaLabel="Role"
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'moderator', label: 'Moderator' },
                  { value: 'treasurer', label: 'Treasurer' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
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
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left text-text-muted">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const avatar = user.discordId ? avatarUrl(user.discordId, user.discordAvatar) : null;
              return (
                <tr
                  key={user.id}
                  className="border-b border-card-border/50 hover:bg-card-bg-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" width={32} height={32} className="rounded-full" />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs font-semibold">
                          {(user.displayName || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{user.displayName}</div>
                        <div className="text-xs text-text-muted truncate">
                          {user.discordUsername ? `@${user.discordUsername}` : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {user.isOwner && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/25 text-gold border border-gold/40"
                          title="Clan owner — provisioned this instance. Cannot be demoted or removed."
                        >
                          👑 Owner
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE_CLS[user.role] ?? ROLE_BADGE_CLS.member}`}
                      >
                        {user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.isOwner ? (
                      // The owner row is protected: no demote/edit/delete for anyone. The owner
                      // themselves manages succession from a non-owner admin's row ("Make owner").
                      <span className="text-xs text-text-muted italic" title="The owner cannot be demoted or removed. Transfer ownership to hand it off.">
                        🔒 Protected
                      </span>
                    ) : (
                    <div className="flex gap-1.5 justify-end flex-wrap">
                      {viewerIsOwner && user.role === 'admin' && (
                        <button
                          onClick={() => handleTransferOwnership(user)}
                          className="px-2 py-1 text-xs border border-gold/40 text-gold hover:bg-gold/10 rounded transition-colors"
                          title="Transfer ownership to this admin"
                        >
                          Make owner
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => quickPromote(user, 'admin')}
                          className="px-2 py-1 text-xs border border-gold/30 text-gold hover:bg-gold/10 rounded transition-colors"
                          title="Promote to admin"
                        >
                          Make admin
                        </button>
                      )}
                      {user.role !== 'treasurer' && (
                        <button
                          onClick={() => quickPromote(user, 'treasurer')}
                          className="px-2 py-1 text-xs border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 rounded transition-colors"
                          title="Set as treasurer (mod + fee collection)"
                        >
                          Make treasurer
                        </button>
                      )}
                      {user.role !== 'editor' && (
                        <button
                          onClick={() => quickPromote(user, 'editor')}
                          className="px-2 py-1 text-xs border border-accent-green/30 text-accent-green-light hover:bg-accent-green/10 rounded transition-colors"
                          title="Set as bingo editor (mod + edit event tiles)"
                        >
                          Make editor
                        </button>
                      )}
                      {user.role !== 'moderator' && (
                        <button
                          onClick={() => quickPromote(user, 'moderator')}
                          className="px-2 py-1 text-xs border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                          title="Set as moderator"
                        >
                          Make mod
                        </button>
                      )}
                      {user.role !== 'member' && (
                        <button
                          onClick={() => quickPromote(user, 'member')}
                          className="px-2 py-1 text-xs border border-card-border text-text-muted hover:bg-brown-light hover:text-foreground rounded transition-colors"
                          title="Demote to member"
                        >
                          Demote
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(user)}
                        className="px-2 py-1 text-xs border border-card-border rounded hover:border-gold/40 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="px-2 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  {users.length === 0 ? 'No users found.' : 'No users match the current filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
