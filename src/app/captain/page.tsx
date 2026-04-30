'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

interface MyTeam {
  teamId: number;
  teamName: string;
  teamColor: string;
  eventId: number;
  eventName: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventForceEndedAt: string | null;
}

export default function CaptainLoginPage() {
  const router = useRouter();
  const [myTeams, setMyTeams] = useState<MyTeam[] | null>(null);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  useEffect(() => {
    fetch('/api/captain/my-teams')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyTeam[]) => setMyTeams(data))
      .catch(() => setMyTeams([]));
  }, []);

  async function claim(teamId: number) {
    const res = await fetch('/api/captain/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Could not claim captain seat');
      return;
    }
    const data = await res.json();
    router.push(data.redirectTo || `/captain/${teamId}`);
  }

  const hasMyTeams = myTeams && myTeams.length > 0;

  return (
    <div className="max-w-md mx-auto mt-12 sm:mt-20">
      {hasMyTeams && (
        <div className="border border-card-border rounded-2xl bg-card-bg p-6 mb-4 shadow-xl shadow-black/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-6 bg-gold rounded-full" />
            <h2 className="text-xl font-bold text-gold">Your captain seats</h2>
          </div>
          <div className="space-y-2">
            {myTeams!.map((t) => {
              const ended = !!t.eventForceEndedAt || (t.eventEndDate ? new Date(t.eventEndDate) < new Date() : false);
              return (
                <button
                  key={t.teamId}
                  onClick={() => claim(t.teamId)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-card-border rounded-lg bg-brown-dark/40 hover:border-gold/40 hover:bg-card-bg-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.teamColor }} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.teamName}</div>
                      <div className="text-xs text-text-muted truncate">
                        {t.eventName} {ended && '· ended'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gold shrink-0">Enter →</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {myTeams === null ? null : !hasMyTeams && !showPasswordFallback ? (
        <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">⚔️</div>
            <h1 className="text-2xl font-bold text-gold">Captain access</h1>
            <p className="text-text-muted text-sm mt-1">
              Captains are assigned by an admin to their Discord account. If you&apos;ve been assigned, your
              teams will appear here automatically.
            </p>
          </div>
          <Link
            href="/login?return=/captain"
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Sign in with Discord
          </Link>
          <button
            onClick={() => setShowPasswordFallback(true)}
            className="w-full mt-3 text-xs text-text-muted hover:text-foreground underline-offset-2 hover:underline"
          >
            Use captain password instead
          </button>
        </div>
      ) : null}

      {showPasswordFallback && <PasswordFallback />}
    </div>
  );
}

function PasswordFallback() {
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
    if (!selectedEvent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing dependent state when parent selection changes
      setTeams([]);
      setSelectedTeam(null);
      return;
    }
    fetch(`/api/events/${selectedEvent}/teams`)
      .then((r) => r.json())
      .then((data) => {
        setTeams(data);
        setSelectedTeam(null);
      });
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
    <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">⚔️</div>
        <h1 className="text-2xl font-bold text-gold">Captain Password Login</h1>
        <p className="text-text-muted text-sm mt-1">Fallback for teams without an assigned Discord captain</p>
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
              <option key={ev.id} value={ev.id}>{ev.name}</option>
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
                  <option key={t.id} value={t.id}>{t.name}</option>
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
  );
}
