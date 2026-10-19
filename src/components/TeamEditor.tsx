'use client';

import { useMemo, useState } from 'react';
import ClanMemberPicker, { type PickableMember } from './ClanMemberPicker';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

const PRESET_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#ff5722', '#795548', '#607d8b',
];

interface EditableTeam {
  id: number;
  name: string;
  color: string;
  captainUserId?: number | null;
  captainName?: string | null;
}

interface Props {
  eventId: number;
  // Omit for create mode; pass the team to edit name/color/captain in place.
  team?: EditableTeam;
  /**
   * The event's teams, captains included, when the caller has them. People who already captain one
   * of the OTHER teams are greyed out in the captain picker — the API refuses a second captaincy in
   * one event (lib/teamCaptain#captainConflict), and finding that out on Save is the slow way.
   */
  eventTeams?: ReadonlyArray<{ id: number; name: string; captainUserId?: number | null }>;
  onClose: () => void;
  onSaved: () => void;
}

// Modal for creating a team or editing an existing one (name, color, captain) — the
// single edit surface, so admins never have to delete-and-recreate to change a captain.
export default function TeamEditor({ eventId, team, eventTeams, onClose, onSaved }: Props) {
  const isEdit = !!team;
  const [name, setName] = useState(team?.name ?? '');
  const [color, setColor] = useState(team?.color ?? PRESET_COLORS[0]);
  const [captainMemberId, setCaptainMemberId] = useState<number | null>(null);
  const [captainMember, setCaptainMember] = useState<PickableMember | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const customColor = !PRESET_COLORS.includes(color);

  const captainsElsewhere = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of eventTeams ?? []) {
      if (t.id !== team?.id && t.captainUserId != null) m.set(t.captainUserId, t.name);
    }
    return m;
  }, [eventTeams, team?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Optional: without a captain the admin picks for this team in the draft (api/events/teams).
    const captainUserId = captainMember?.user?.id ?? null;

    setSaving(true);
    try {
      const res = isEdit
        ? await clanFetch(`/api/events/${eventId}/teams`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamId: team.id,
              name: name.trim(),
              color,
              // Only send a captain change when a new one was actually picked.
              ...(captainUserId != null ? { captainUserId } : {}),
            }),
          })
        : await clanFetch(`/api/events/${eventId}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), color, captainUserId }),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (isEdit ? 'Failed to save team' : 'Failed to create team'));
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Network error — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-card-bg border border-card-border rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto m-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {isEdit ? `Edit ${team.name}` : 'Add Team'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-foreground transition-colors text-lg leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Team Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              autoFocus
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
              placeholder="e.g. The Iron Squad"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all duration-150"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#fff' : 'transparent',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: color === c ? `0 0 10px ${c}60` : 'none',
                  }}
                />
              ))}
              <label
                className="relative w-8 h-8 rounded-full border-2 cursor-pointer flex items-center justify-center text-[10px] font-bold transition-all duration-150"
                style={{
                  backgroundColor: customColor ? color : 'transparent',
                  borderColor: customColor ? '#fff' : 'var(--color-card-border, #444)',
                  transform: customColor ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: customColor ? `0 0 10px ${color}60` : 'none',
                }}
                title="Custom color"
              >
                {!customColor && <span className="text-text-muted">+</span>}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-foreground/70">
                Captain <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <span className="text-[11px] text-text-muted">Captains can also be players</span>
            </div>
            {/* Why some people are greyed out. This was only in a hover title, so a clan whose members
                hadn't signed in yet saw a list where nothing could be picked and no reason why. */}
            <p className="text-xs text-text-muted mb-2 leading-relaxed">
              A captain picks for their team in the draft, from their own Anvil login. Only people who have signed
              in to Anvil with Discord can be one; the rest are greyed out. No captain is fine: you pick for the
              team yourself, and can add a captain later with Edit.
            </p>
            {isEdit && (
              <p className="text-xs text-text-muted mb-2">
                Current captain:{' '}
                <span className="text-foreground/80 font-medium">{team.captainName ?? 'none assigned'}</span>
                {' — '}pick a member below to hand the seat over, or leave it to keep them.
              </p>
            )}
            <ClanMemberPicker
              mode="single"
              value={captainMemberId}
              onChange={(id, member) => {
                setCaptainMemberId(id);
                setCaptainMember(member);
              }}
              preferLinked
              captainsElsewhere={captainsElsewhere}
              requireDiscordUser
              requireDiscordUserHint="Hasn't signed in to Anvil with Discord yet, so they can't log in as captain."
              emptyState="No clan members yet — sync the clan from the plugin first."
            />
            {captainMember && (
              <p className="text-xs text-accent-green-light mt-1">
                ✓ {captainMember.user?.displayName ?? captainMember.rsn} will get captain access on Discord login.
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-card-border text-text-muted hover:text-foreground font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 bg-gold hover:bg-gold-light text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
