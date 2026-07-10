'use client';

import { useEffect, useState } from 'react';
import Input from '@/components/Input';

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

interface LinkedAccount {
  clanMemberId: number;
  rsn: string;
  status: string;
  isCurrent: boolean;
}

export default function PlayerEditor({ eventId, player, onClose, onSaved }: Props) {
  const [name, setName] = useState(player.name);
  const [discord, setDiscord] = useState(player.discord || '');
  const [timezone, setTimezone] = useState(player.timezone || '');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [selectedClanMemberId, setSelectedClanMemberId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the RuneScape accounts linked to this player's Discord owner — swap candidates for when an
  // RSN gets banned/renamed and they play on an alt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/players/${player.id}/linked-accounts`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const list: LinkedAccount[] = data.accounts ?? [];
            setAccounts(list);
            const cur = list.find((a) => a.isCurrent);
            setSelectedClanMemberId(cur ? cur.clanMemberId : null);
          }
        }
      } catch {
        /* ignore — the RSN text field still works without the account list */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, player.id]);

  const currentClanMemberId = accounts.find((a) => a.isCurrent)?.clanMemberId ?? null;
  const accountChanged = selectedClanMemberId != null && selectedClanMemberId !== currentClanMemberId;

  function pickAccount(cmId: number) {
    setSelectedClanMemberId(cmId);
    const acc = accounts.find((a) => a.clanMemberId === cmId);
    if (acc) setName(acc.rsn); // the tracked RSN follows the chosen account
  }

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
          ...(selectedClanMemberId != null ? { clanMemberId: selectedClanMemberId } : {}),
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
          {/* Tracked account — only when the player's Discord owner has more than one linked RSN.
              Picking a different one swaps which account is tracked (plugin + hiscores). */}
          {accounts.length > 1 && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Tracked account</label>
              <select
                value={selectedClanMemberId ?? ''}
                onChange={(e) => pickAccount(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              >
                {accounts.map((a) => (
                  <option key={a.clanMemberId} value={a.clanMemberId}>
                    {a.rsn}
                    {a.status && a.status !== 'active' ? ` (${a.status})` : ''}
                    {a.isCurrent ? ' — current' : ''}
                  </option>
                ))}
              </select>
              {accountChanged && (
                <p className="text-[11px] text-yellow-400 mt-1 leading-relaxed">
                  Swaps tracking to this RSN for both the RuneLite plugin and the hiscores stat cron,
                  and re-baselines stats from it (gains count from the swap onward).
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-text-muted mb-1">RSN (In-Game Name)</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Player name..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Discord Username</label>
            <Input
              type="text"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              className="w-full px-3 py-2 bg-brown-dark border border-card-border rounded text-sm text-foreground"
              placeholder="Discord username..."
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Timezone</label>
            <Input
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
