'use client';

import { useState, useEffect } from 'react';
import LocalTime from '@/components/LocalTime';
import Input from '@/components/Input';
import { clanFetch } from '@/lib/clanFetch';

interface StatData {
  stat: string;
  type: string;
  tileLabel: string;
  baseline: number;
  current: number;
  gained: number;
}

interface Props {
  eventId: number;
  playerId: number;
  playerName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function PlayerBaselineEditor({ eventId, playerId, playerName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatData[]>([]);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [eventId, playerId]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/players/${playerId}/snapshot`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || []);
        setSnapshotAt(data.snapshotAt);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveBaseline(stat: string, statType: string, baseline: number) {
    setSaving(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/players/${playerId}/snapshot`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stat, statType, baseline }),
      });
      if (res.ok) {
        await fetchData();
        onSaved();
      }
    } finally {
      setSaving(false);
      setEditingIdx(null);
    }
  }

  async function resetSnapshot() {
    if (!confirm(`Reset ${playerName}'s baseline to current stats? This will set their gains to 0.`)) return;
    setResetting(true);
    try {
      const res = await clanFetch(`/api/events/${eventId}/players/${playerId}/snapshot`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetAll: true }),
      });
      if (res.ok) {
        await fetchData();
        onSaved();
      }
    } finally {
      setResetting(false);
    }
  }

  function startEdit(idx: number, currentBaseline: number) {
    setEditingIdx(idx);
    setEditValue(currentBaseline.toString());
  }

  function handleSave(stat: StatData) {
    const newBaseline = parseInt(editValue, 10);
    if (isNaN(newBaseline) || newBaseline < 0) return;
    saveBaseline(stat.stat, stat.type, newBaseline);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card-bg border-b border-card-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gold">{playerName}</h2>
            <p className="text-xs text-text-muted">Edit baseline stats</p>
            {snapshotAt && (
              <p className="text-xs text-text-muted">
                Snapshot: <LocalTime date={snapshotAt} />
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-foreground text-xl">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <p className="text-text-muted text-center py-8">Loading...</p>
          ) : stats.length === 0 ? (
            <p className="text-text-muted text-center py-8">No tracked stats for this event</p>
          ) : (
            <div className="space-y-2">
              {stats.map((stat, idx) => (
                <div
                  key={stat.stat}
                  className="border border-card-border rounded-lg p-3 bg-brown-dark/50"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground capitalize">
                      {stat.stat.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      stat.type === 'skill' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {stat.type === 'skill' ? 'XP' : 'KC'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">Tile: {stat.tileLabel}</p>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-text-muted">Baseline</span>
                      <p className="font-medium text-foreground">{stat.baseline.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Current</span>
                      <p className="font-medium text-foreground">{stat.current.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Gained</span>
                      <p className="font-medium text-accent-green-light">+{stat.gained.toLocaleString()}</p>
                    </div>
                  </div>

                  {editingIdx === idx ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 bg-brown-dark border border-card-border rounded text-sm"
                        min="0"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(stat)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-medium bg-accent-green/20 text-accent-green-light border border-accent-green/30 rounded hover:bg-accent-green/30 disabled:opacity-50"
                      >
                        {saving ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="px-3 py-1 text-xs text-text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(idx, stat.baseline)}
                      className="text-xs text-gold hover:text-gold-light underline"
                    >
                      Edit baseline
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card-bg border-t border-card-border p-4">
          <button
            onClick={resetSnapshot}
            disabled={resetting}
            className="w-full py-2 text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset All Baselines to Current'}
          </button>
        </div>
      </div>
    </div>
  );
}
