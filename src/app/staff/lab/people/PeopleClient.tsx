'use client';

import { useEffect, useState } from 'react';

import SupporterName from '@/components/SupporterName';
import { CLAN_ROLES, type ClanRole } from '@/lib/clanRoles';
import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import Select from '@/components/Select';

interface TestUser {
  userId: number;
  rsn: string;
  tier: SupporterTierId | null;
}

interface State {
  users: TestUser[];
  clanRole: ClanRole;
}

export default function PeopleClient() {
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/staff/lab/cast');
    if (res.ok) setState(await res.json());
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount fetch
    void load();
  }, []);

  async function act(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError('');
    const res = await fetch('/api/staff/lab/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'That didn’t work.');
      return false;
    }
    if (data.users) setState(data);
    return true;
  }

  async function viewAs(userId: number) {
    // The apex account page on purpose: /staff lives on the apex, and that is where they land as the test user.
    // eslint-disable-next-line clan-scope/clan-prefix -- apex /profile, not a clan path
    if (await act({ action: 'view-as', userId })) window.location.href = '/profile';
  }

  const btn = 'rounded-lg border border-card-border px-2.5 py-1 text-xs hover:border-gold/60 disabled:opacity-50';
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Your role in the lab clan</h2>
        <p className="mt-1 text-sm text-text-muted">
          See the lab clan&rsquo;s admin pages and the plugin as each role does. Starting a session leaves your choice alone.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...CLAN_ROLES].reverse().map((r) => (
            <button
              key={r}
              type="button"
              disabled={busy}
              onClick={() => void act({ action: 'clan-role', role: r })}
              className={`${btn} ${state?.clanRole === r ? 'border-gold/60 text-gold' : 'text-gray-200'}`}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-card-border bg-card-bg p-4">
        <h2 className="font-semibold">Test users</h2>
        <p className="mt-1 text-sm text-text-muted">
          <b>View as</b> signs this browser in as them for up to 4 hours (an amber bar on every page switches back).
          Tiers last a day. Teams are set on each lab session.
        </p>
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ action: 'add-user', name }).then((ok) => ok && setName(''));
          }}
        >
          <span className="text-sm text-text-muted">Lab~</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={8}
            placeholder="Captain"
            className="w-32 rounded border border-card-border bg-background px-2 py-1 text-sm"
          />
          <button type="submit" disabled={busy || !name.trim()} className={`${btn} text-gold`}>Add test user</button>
        </form>
        <ul className="mt-4 divide-y divide-card-border">
          {state?.users.length === 0 && <li className="py-2 text-sm text-text-muted">No test users yet.</li>}
          {state?.users.map((u) => (
            <li key={u.userId} className="flex flex-wrap items-center gap-3 py-2">
              <SupporterName name={u.rsn} tier={u.tier} plain className="min-w-[9rem] text-sm font-medium" />
              <Select
                value={u.tier ?? ''}
                disabled={busy}
                onChange={(v) => void act({ action: 'user-tier', userId: u.userId, tier: v || null })}
                options={[{ value: '', label: 'No tier' }, ...SUPPORTER_TIER_ORDER.map((t) => ({ value: t, label: SUPPORTER_TIERS[t].name }))]}
                ariaLabel={`${u.rsn}'s Supporter tier`}
                className="w-32"
              />
              <button type="button" disabled={busy} onClick={() => void viewAs(u.userId)} className={`${btn} text-amber-200`}>
                View as
              </button>
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
