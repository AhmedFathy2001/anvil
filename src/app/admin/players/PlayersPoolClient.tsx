'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlayerEditor from '@/components/PlayerEditor';
import Select from '@/components/Select';
import Input from '@/components/Input';

interface Player {
  id: number;
  eventId: number;
  name: string;
  discord: string | null;
  timezone: string | null;
  teamId: number | null;
  playerToken: string | null;
  eventName: string;
  teamName: string | null;
  teamColor: string | null;
}

export default function PlayersPoolClient() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  async function fetchPlayers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/players');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } finally {
      setLoading(false);
    }
  }

  // Get unique events for filter
  const events = Array.from(new Set(players.map(p => p.eventName))).sort();

  // Filter players
  const filteredPlayers = players.filter(p => {
    const matchesSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.discord?.toLowerCase().includes(search.toLowerCase()) ||
      p.teamName?.toLowerCase().includes(search.toLowerCase());
    const matchesEvent = filterEvent === 'all' || p.eventName === filterEvent;
    return matchesSearch && matchesEvent;
  });

  // Group by event
  const playersByEvent = filteredPlayers.reduce((acc, p) => {
    if (!acc[p.eventName]) acc[p.eventName] = [];
    acc[p.eventName].push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/dashboard" className="text-text-muted text-sm hover:text-gold transition-colors">
              &larr; Back to dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gold mt-2">Player Pool</h1>
            <p className="text-text-muted text-sm mt-1">{players.length} players across all events</p>
          </div>
          <Link
            href="/admin/clan"
            className="px-4 py-2 text-sm border border-gold/30 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
          >
            Manage Clan Roster
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, discord, or team..."
            className="flex-1 px-4 py-2 bg-card-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
          />
          <Select
            value={filterEvent}
            onChange={setFilterEvent}
            ariaLabel="Filter by event"
            className="shrink-0 sm:w-48"
            options={[{ value: 'all', label: 'All Events' }, ...events.map((e) => ({ value: e, label: e }))]}
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-text-muted">Loading players...</div>
        ) : filteredPlayers.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            {search || filterEvent !== 'all' ? 'No players match your search' : 'No players found'}
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(playersByEvent).map(([eventName, eventPlayers]) => (
              <div key={eventName}>
                <h2 className="text-lg font-bold text-gold mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-gold rounded-full" />
                  {eventName}
                  <span className="text-sm font-normal text-text-muted">({eventPlayers.length} players)</span>
                </h2>
                <div className="grid gap-2">
                  {eventPlayers.map(player => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between border border-card-border rounded-lg p-3 bg-card-bg hover:border-gold/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{player.name}</span>
                            {player.discord && player.discord !== player.name && (
                              <span className="text-xs text-text-muted">({player.discord})</span>
                            )}
                            {player.timezone && (
                              <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">
                                {player.timezone}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {player.teamName ? (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: (player.teamColor || '#888') + '20',
                                  color: player.teamColor || '#888'
                                }}
                              >
                                {player.teamName}
                              </span>
                            ) : (
                              <span className="text-xs text-text-muted">Not drafted</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingPlayer(player)}
                        className="text-xs text-gold hover:text-gold-light transition-colors border border-gold/20 px-3 py-1 rounded hover:bg-gold/10"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player Editor Modal */}
      {editingPlayer && (
        <PlayerEditor
          eventId={editingPlayer.eventId}
          player={{
            id: editingPlayer.id,
            name: editingPlayer.name,
            discord: editingPlayer.discord,
            timezone: editingPlayer.timezone,
          }}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => {
            fetchPlayers();
            router.refresh();
          }}
        />
      )}

    </div>
  );
}
