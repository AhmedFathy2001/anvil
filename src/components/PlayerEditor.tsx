'use client';

import { useState } from 'react';

interface Props {
  eventId: number;
  player: {
    id: number;
    name: string;
    discord: string | null;
    timezone: string | null;
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function PlayerEditor({ eventId, player, onClose, onSaved }: Props) {
  const [name, setName] = useState(player.name);
  const [discord, setDiscord] = useState(player.discord || '');
  const [timezone, setTimezone] = useState(player.timezone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/players`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.id,
          name: name.trim(),
          discord: discord.trim() || null,
          timezone: timezone.trim() || null,
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-4 border-b border-card-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold">Edit Player</h2>
          <button onClick={onClose} className="text-text-muted hover:text-foreground text-xl">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1">RSN (In-Game Name)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Player name..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Discord Username</label>
            <input
              type="text"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Discord username..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="e.g. UTC, EST, PST..."
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
