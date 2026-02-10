'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
}

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Create form state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator'>('moderator');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'moderator'>('moderator');
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
    fetchUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: newUsername,
        displayName: newDisplayName || newUsername,
        password: newPassword,
        role: newRole,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setCreateError(data.error || 'Failed to create user');
      setCreating(false);
      return;
    }

    setNewUsername('');
    setNewDisplayName('');
    setNewPassword('');
    setNewRole('moderator');
    setShowCreate(false);
    setCreating(false);
    fetchUsers();
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditRole(user.role as 'admin' | 'moderator');
    setEditPassword('');
    setEditError('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    setSaving(true);

    const body: Record<string, string> = {};
    if (editDisplayName !== editingUser.displayName) body.displayName = editDisplayName;
    if (editPassword) body.password = editPassword;
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

  async function handleDelete(user: User) {
    if (!confirm(`Delete user "${user.username}"?`)) return;

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold">User Management</h1>
          <p className="text-text-muted text-sm mt-1">Manage admin and moderator accounts</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
          >
            Back
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-1.5 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors"
          >
            + Create User
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Create User</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="(optional)"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'moderator')}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm border border-card-border rounded-lg hover:border-gold/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-semibold bg-gold hover:bg-yellow-500 text-brown-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div className="border border-card-border rounded-xl bg-card-bg p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">Edit: {editingUser.username}</h2>
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1">Display Name</label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">New Password (leave blank to keep)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                  placeholder="(unchanged)"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'admin' | 'moderator')}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
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
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Display Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-card-border/50 hover:bg-card-bg-hover transition-colors">
                <td className="px-4 py-3 font-medium">{user.username}</td>
                <td className="px-4 py-3 text-text-muted">{user.displayName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-gold/15 text-gold'
                        : 'bg-blue-500/15 text-blue-400'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
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
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
