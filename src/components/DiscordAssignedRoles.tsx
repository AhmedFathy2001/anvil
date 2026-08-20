'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

interface Role {
  id: string;
  name: string;
  position: number;
}

// One selectable list of Discord roles: a label + selected count, a name filter, and the
// scrollable pills. Kept at module scope (not inline in the component) so the search input
// keeps focus across re-renders. Filtering is case-insensitive substring on the role name.
function RoleList({
  label,
  hint,
  roles,
  selected,
  onToggle,
  query,
  onQueryChange,
}: {
  label: string;
  hint: string;
  roles: Role[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q ? roles.filter((r) => r.name.toLowerCase().includes(q)) : roles;
  return (
    <div>
      <p className="text-sm font-medium mb-0.5">
        {label} <span className="text-text-muted font-normal">· {selected.size} selected</span>
      </p>
      <p className="text-xs text-text-muted mb-1.5">{hint}</p>
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={`Filter ${label.toLowerCase()}…`}
        className="mb-1.5 text-xs px-2 py-1.5"
      />
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-card-border rounded-lg bg-brown-dark">
        {filtered.length === 0 ? (
          <p className="text-xs text-text-muted px-1 py-0.5">No roles match.</p>
        ) : (
          filtered.map((r) => {
            const on = selected.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onToggle(r.id)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  on
                    ? 'bg-gold/20 text-gold border-gold/40'
                    : 'text-text-muted border-card-border hover:text-foreground'
                }`}
              >
                {on ? '✓ ' : ''}
                {r.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Picks which Discord roles the role sync assigns to every member (default) and every guest.
// Without this configured, the sync resolves people but has nothing to give them — so nobody
// gets a role. Reads/writes discord_default_role_ids / discord_guest_role_ids via the roles API.
export default function DiscordAssignedRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [defaultIds, setDefaultIds] = useState<Set<string>>(new Set());
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [guestQuery, setGuestQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await clanFetch('/api/admin/discord/roles');
        if (res.ok) {
          const data = await res.json();
          setRoles(data.roles ?? []);
          setDefaultIds(new Set<string>(data.defaultRoleIds ?? []));
          setGuestIds(new Set<string>(data.guestRoleIds ?? []));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await clanFetch('/api/admin/discord/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultRoleIds: [...defaultIds], guestRoleIds: [...guestIds] }),
      });
      if (res.ok) setMessage({ type: 'success', text: 'Saved. Run "Sync roles & nicknames now" to apply.' });
      else setMessage({ type: 'error', text: (await res.json()).error || 'Failed to save' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-text-muted text-sm">Loading roles…</p>;

  if (roles.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No assignable roles found — enable role sync + set the bot token and server ID first, and make
        sure the bot&apos;s role sits above the roles you want it to hand out.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted -mt-1">
        These are <span className="text-foreground">Discord server roles your bot hands out during
        role sync</span>. The sync matches each person to their linked account, but only assigns the
        roles you tick below — leave a list empty and those people still resolve, they just receive
        no role.
      </p>

      <RoleList
        label="Member roles"
        hint="Every full member gets these."
        roles={roles}
        selected={defaultIds}
        onToggle={(id) => toggle(setDefaultIds, id)}
        query={memberQuery}
        onQueryChange={setMemberQuery}
      />

      <RoleList
        label="Guest roles"
        hint="Verified guests get these instead."
        roles={roles}
        selected={guestIds}
        onToggle={(id) => toggle(setGuestIds, id)}
        query={guestQuery}
        onQueryChange={setGuestQuery}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold bg-gold text-bg rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save assigned roles'}
        </button>
        {message && (
          <span className={`text-xs ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
