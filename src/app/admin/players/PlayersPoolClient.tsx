'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlayerEditor from '@/components/PlayerEditor';

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

interface WomMember {
  username: string;
  displayName: string;
  type: string;
  role: string;
}

interface Event {
  id: number;
  name: string;
}

export default function PlayersPoolClient() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // WOM import state
  const [showWomImport, setShowWomImport] = useState(false);
  const [womMembers, setWomMembers] = useState<WomMember[]>([]);
  const [womGroupName, setWomGroupName] = useState('');
  const [womLoading, setWomLoading] = useState(false);
  const [selectedWomMembers, setSelectedWomMembers] = useState<Set<string>>(new Set());
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [importEventId, setImportEventId] = useState<string>('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchPlayers();
    fetchEvents();
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

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setAllEvents(data);
      }
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  }

  async function fetchWomGroup() {
    setWomLoading(true);
    try {
      const res = await fetch('/api/admin/wom-group');
      if (res.ok) {
        const data = await res.json();
        setWomMembers(data.members);
        setWomGroupName(data.groupName);
        setSelectedWomMembers(new Set());
      }
    } catch (e) {
      console.error('Failed to fetch WOM group:', e);
    } finally {
      setWomLoading(false);
    }
  }

  async function importSelectedPlayers() {
    if (!importEventId || selectedWomMembers.size === 0) return;

    setImporting(true);
    try {
      // Format as array of { name } objects for the API
      const playersToAdd = womMembers
        .filter(m => selectedWomMembers.has(m.username))
        .map(m => ({ name: m.displayName }));

      const res = await fetch(`/api/events/${importEventId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playersToAdd),
      });

      if (res.ok) {
        fetchPlayers();
        setSelectedWomMembers(new Set());
        setShowWomImport(false);
      }
    } catch (e) {
      console.error('Failed to import players:', e);
    } finally {
      setImporting(false);
    }
  }

  function toggleWomMember(username: string) {
    const newSet = new Set(selectedWomMembers);
    if (newSet.has(username)) {
      newSet.delete(username);
    } else {
      newSet.add(username);
    }
    setSelectedWomMembers(newSet);
  }

  function selectAllWom() {
    setSelectedWomMembers(new Set(womMembers.map(m => m.username)));
  }

  function selectNoneWom() {
    setSelectedWomMembers(new Set());
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
          <button
            onClick={() => {
              setShowWomImport(true);
              if (womMembers.length === 0) fetchWomGroup();
            }}
            className="px-4 py-2 text-sm border border-gold/30 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
          >
            Import from WOM
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, discord, or team..."
            className="flex-1 px-4 py-2 bg-card-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
          />
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="px-4 py-2 bg-card-bg border border-card-border rounded-lg text-sm focus:outline-none focus:border-gold"
          >
            <option value="all">All Events</option>
            {events.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
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
                                  backgroundColor: player.teamColor + '20',
                                  color: player.teamColor
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

      {/* WOM Import Modal */}
      {showWomImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWomImport(false)} />
          <div className="relative bg-card-bg border border-card-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-card-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gold">Import from WiseOldMan</h2>
                {womGroupName && (
                  <p className="text-xs text-text-muted mt-0.5">Group: {womGroupName}</p>
                )}
              </div>
              <button onClick={() => setShowWomImport(false)} className="text-text-muted hover:text-foreground text-xl">
                &times;
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto">
              {womLoading ? (
                <div className="text-center py-8 text-text-muted">Loading members from WOM...</div>
              ) : womMembers.length === 0 ? (
                <div className="text-center py-8 text-text-muted">No members found</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllWom}
                        className="text-xs text-gold hover:underline"
                      >
                        Select all
                      </button>
                      <span className="text-text-muted">|</span>
                      <button
                        onClick={selectNoneWom}
                        className="text-xs text-gold hover:underline"
                      >
                        Select none
                      </button>
                    </div>
                    <button
                      onClick={fetchWomGroup}
                      className="text-xs text-text-muted hover:text-gold"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto">
                    {womMembers.map(member => (
                      <label
                        key={member.username}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                          selectedWomMembers.has(member.username)
                            ? 'border-gold bg-gold/10'
                            : 'border-card-border hover:border-gold/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedWomMembers.has(member.username)}
                          onChange={() => toggleWomMember(member.username)}
                          className="accent-gold"
                        />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{member.displayName}</div>
                          {member.type !== 'regular' && (
                            <span className="text-[10px] text-text-muted capitalize">{member.type}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-card-border shrink-0">
              <div className="flex items-center gap-3">
                <select
                  value={importEventId}
                  onChange={(e) => setImportEventId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-brown-dark border border-card-border rounded text-sm"
                >
                  <option value="">Select event to import to...</option>
                  {allEvents.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button
                  onClick={importSelectedPlayers}
                  disabled={importing || !importEventId || selectedWomMembers.size === 0}
                  className="px-4 py-2 text-sm font-semibold rounded bg-gold/20 border border-gold text-gold hover:bg-gold/30 disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Importing...' : `Import ${selectedWomMembers.size} players`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
