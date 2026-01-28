'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Event {
  id: number;
  name: string;
  boardSize: number;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

export default function CaptainLoginPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => setEvents(data));
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetch(`/api/events/${selectedEvent}/teams`)
        .then((r) => r.json())
        .then((data) => {
          setTeams(data);
          setSelectedTeam(null);
        });
    } else {
      setTeams([]);
      setSelectedTeam(null);
    }
  }, [selectedEvent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeam) return;
    setError('');
    setLoading(true);

    const res = await fetch('/api/captain/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: selectedTeam, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Invalid password');
      setLoading(false);
      return;
    }

    router.push(`/captain/${selectedTeam}`);
  }

  const selectedTeamObj = teams.find((t) => t.id === selectedTeam);

  return (
    <div className="max-w-sm mx-auto mt-16 sm:mt-24">
      <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⚔️</div>
          <h1 className="text-2xl font-bold text-gold">Captain Login</h1>
          <p className="text-text-muted text-sm mt-1">Select your event and team to get started</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-1.5">Event</label>
            <select
              value={selectedEvent || ''}
              onChange={(e) => setSelectedEvent(e.target.value ? parseInt(e.target.value) : null)}
              required
              className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
            >
              <option value="">Select an event...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {selectedEvent && (
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1.5">Team</label>
              {teams.length === 0 ? (
                <p className="text-text-muted text-sm italic">No teams in this event.</p>
              ) : (
                <select
                  value={selectedTeam || ''}
                  onChange={(e) => setSelectedTeam(e.target.value ? parseInt(e.target.value) : null)}
                  required
                  className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
                >
                  <option value="">Select your team...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {selectedTeamObj && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-card-border bg-brown-light/50">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTeamObj.color }} />
              <span className="text-sm font-medium">{selectedTeamObj.name}</span>
            </div>
          )}

          {selectedTeam && (
            <div>
              <label className="block text-sm font-medium text-foreground/70 mb-1.5">Captain Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full bg-brown-light border border-card-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30"
                placeholder="Enter team password"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {selectedTeam && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold hover:bg-yellow-500 text-brown-dark font-bold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login as Captain'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
