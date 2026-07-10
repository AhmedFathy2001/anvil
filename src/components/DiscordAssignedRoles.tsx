'use client';

import { useEffect, useState } from 'react';

interface Role {
  id: string;
  name: string;
  position: number;
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/discord/roles');
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
      const res = await fetch('/api/admin/discord/roles', {
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

  const RoleList = ({
    selected,
    onToggle,
  }: {
    selected: Set<string>;
    onToggle: (id: string) => void;
  }) => (
    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 border border-card-border rounded-lg bg-brown-dark">
      {roles.map((r) => {
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
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted -mt-1">
        Pick the roles the sync gives people. Without these set, the sync resolves everyone but hands
        out nothing — which is why members can resolve yet still get no role.
      </p>

      <div>
        <p className="text-sm font-medium mb-1">
          Member roles <span className="text-text-muted font-normal">(every full member gets these)</span>
        </p>
        <RoleList selected={defaultIds} onToggle={(id) => toggle(setDefaultIds, id)} />
      </div>

      <div>
        <p className="text-sm font-medium mb-1">
          Guest roles <span className="text-text-muted font-normal">(verified guests get these instead)</span>
        </p>
        <RoleList selected={guestIds} onToggle={(id) => toggle(setGuestIds, id)} />
      </div>

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
