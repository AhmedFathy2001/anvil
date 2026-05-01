'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

      {myTeams === null ? null : !hasMyTeams ? (
        <div className="border border-card-border rounded-2xl bg-card-bg p-6 sm:p-8 shadow-xl shadow-black/20">
          <div className="text-center mb-4">
            <div className="text-3xl mb-2">⚔️</div>
            <h1 className="text-2xl font-bold text-gold">Captain access</h1>
            <p className="text-text-muted text-sm mt-1">
              Captains are assigned to your Discord account. Once an admin sets you as captain of a team,
              your teams will appear here.
            </p>
          </div>
          <Link
            href="/login?return=/captain"
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Sign in with Discord
          </Link>
        </div>
      ) : null}
    </div>
  );
}
