'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ClanMemberPicker, { type PickableMember } from './ClanMemberPicker';

const PRESET_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#00bcd4', '#ff5722', '#795548', '#607d8b',
];

interface TeamFormProps {
  eventId: number;
  onCreated?: () => void;
}

export default function TeamForm({ eventId, onCreated }: TeamFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [captainMemberId, setCaptainMemberId] = useState<number | null>(null);
  const [captainMember, setCaptainMember] = useState<PickableMember | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const captainUserId = captainMember?.user?.id ?? null;
    if (captainUserId == null) {
      setError('Pick a Discord-linked clan member to be captain.');
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, captainUserId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create team');
      setLoading(false);
      return;
    }

    setName('');
    setCaptainMemberId(null);
    setCaptainMember(null);
    setLoading(false);
    onCreated?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-card-border rounded-xl p-4 bg-card-bg">
      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Team Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
          placeholder="e.g. The Iron Squad"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground/70 mb-1.5">Color</label>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-foreground/70">Captain</label>
          <span className="text-[11px] text-text-muted">Captains can also be players</span>
        </div>
        <ClanMemberPicker
          mode="single"
          value={captainMemberId}
          onChange={(id, member) => {
            setCaptainMemberId(id);
            setCaptainMember(member);
          }}
          requireDiscordUser
          preferLinked
          emptyState="No clan members yet — sync the clan from the plugin first."
        />
        {captainMember && (
          <p className="text-xs text-accent-green-light mt-1">
            ✓ {captainMember.user?.displayName ?? captainMember.rsn} will get captain access on Discord login.
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gold hover:bg-yellow-500 text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Adding…' : 'Add Team'}
      </button>
    </form>
  );
}
