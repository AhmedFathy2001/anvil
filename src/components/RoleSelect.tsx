'use client';

import { useEffect, useState } from 'react';
import Select, { type SelectOption } from '@/components/Select';
import Input from '@/components/Input';
import { loadGuildRoles, createGuildRole, type GuildRole } from '@/lib/rolesClient';

interface RoleSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noneLabel?: string; // label for the "no role" option
  allowNone?: boolean;
  ariaLabel?: string;
  className?: string;
}

// Sentinel option value — picking it opens the inline "create a role" form instead of selecting.
const CREATE = '__create_role__';

// Pick a Discord role from a dropdown of the guild's roles instead of pasting a role ID, or create a
// brand-new role inline. Falls back to a manual ID field when the bot isn't connected (no roles to
// list), so nothing breaks off-bot — but the create shortcut is still offered there too.
export default function RoleSelect({
  value,
  onChange,
  placeholder = 'Select a role…',
  noneLabel = 'None',
  allowNone = true,
  ariaLabel,
  className,
}: RoleSelectProps) {
  const [roles, setRoles] = useState<GuildRole[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Optional styling for a freshly-created role.
  const [useColor, setUseColor] = useState(false);
  const [color, setColor] = useState('#5865f2'); // Discord blurple, a sensible default
  const [mentionable, setMentionable] = useState(false);

  useEffect(() => {
    loadGuildRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  function openCreate() {
    setNewName('');
    setError('');
    setUseColor(false);
    setColor('#5865f2');
    setMentionable(false);
    setCreating(true);
  }

  async function submitCreate() {
    const name = newName.trim();
    if (!name) {
      setError('Enter a role name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const role = await createGuildRole(name, {
        color: useColor ? parseInt(color.slice(1), 16) : undefined,
        mentionable,
      });
      // Refresh the shared list so this (and every other) picker sees the new role.
      const fresh = await loadGuildRoles(true).catch(() => null);
      if (fresh) setRoles(fresh);
      onChange(role.id);
      setCreating(false);
      setNewName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the role');
    } finally {
      setBusy(false);
    }
  }

  if (roles === null) return <div className="text-text-muted text-sm">Loading roles…</div>;

  // Inline create form — shared by both the dropdown and the manual-ID branches.
  if (creating) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="New role name"
            maxLength={100}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
          />
          <button
            type="button"
            onClick={submitCreate}
            disabled={busy}
            className="shrink-0 px-3 py-2 text-sm font-semibold rounded-lg bg-gold text-bg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName('');
              setError('');
            }}
            disabled={busy}
            className="shrink-0 px-3 py-2 text-sm rounded-lg border border-card-border text-text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4 flex-wrap text-xs text-text-muted">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useColor}
              onChange={(e) => setUseColor(e.target.checked)}
              className="h-3.5 w-3.5 accent-gold"
            />
            Colour
          </label>
          {useColor && (
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Role colour"
              className="h-7 w-10 shrink-0 cursor-pointer rounded border border-card-border bg-transparent p-0.5"
            />
          )}
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mentionable}
              onChange={(e) => setMentionable(e.target.checked)}
              className="h-3.5 w-3.5 accent-gold"
            />
            Mentionable
            <span className="text-text-muted/70">(lets anyone @mention it)</span>
          </label>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        <p className="text-xs text-text-muted mt-1">Creates a new role in your Discord server.</p>
      </div>
    );
  }

  // No roles to list (bot not connected) — keep manual ID entry working, plus a create shortcut.
  if (roles.length === 0) {
    return (
      <div className={className}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Role ID (connect the bot to pick from a list)"
          className="w-full px-3 py-2 rounded-lg bg-brown-dark border border-card-border text-sm focus:outline-none focus:border-gold/60"
        />
        <button type="button" onClick={openCreate} className="mt-1 text-xs text-gold hover:underline">
          ＋ Create a new role
        </button>
      </div>
    );
  }

  const options: SelectOption[] = [
    ...(allowNone ? [{ value: '', label: noneLabel }] : []),
    ...roles.map((r) => ({
      value: r.id,
      label: `@${r.name}`,
      dot: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined,
    })),
    { value: CREATE, label: '＋ Create a new role…' },
  ];

  function handleChange(v: string) {
    if (v === CREATE) {
      openCreate();
      return;
    }
    onChange(v);
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}
