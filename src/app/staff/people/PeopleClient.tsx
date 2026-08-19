'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PersonHit } from '@/lib/platformView';

const PLATFORM_ROLES = ['none', 'support', 'staff', 'root'] as const;

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'gold' | 'red' | 'green' }) {
  const tones = {
    gray: 'border-card-border text-gray-400',
    gold: 'border-gold/40 text-gold',
    red: 'border-red-900 text-red-300',
    green: 'border-emerald-900 text-emerald-300',
  };
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

/**
 * One person, everywhere they exist.
 *
 * The shape of this card is the argument for the whole identity remodel: one human, their accounts,
 * and the several clans those accounts sit in — a question the old one-database-per-clan model could
 * not even be asked.
 */
function PersonCard({
  person,
  canWrite,
  canGrant,
  onChanged,
}: {
  person: PersonHit;
  canWrite: boolean;
  canGrant: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/people/${person.playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setConfirming(false);
      setReason('');
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const active = person.memberships.filter((m) => !m.left);
  const past = person.memberships.filter((m) => m.left);

  return (
    <div className={`rounded-xl border border-card-border bg-card-bg p-4 ${busy ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">{person.displayName ?? `Person #${person.playerId}`}</span>
        {person.banned && <Pill tone="red">platform-banned</Pill>}
        {person.platformRole !== 'none' && <Pill tone="gold">platform {person.platformRole}</Pill>}
        <span className="text-xs text-gray-600">#{person.playerId}</span>
      </div>

      {person.banned && person.bannedReason && (
        <p className="mt-2 text-sm text-red-300">Reason: {person.bannedReason}</p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
            Accounts ({person.accounts.length})
          </div>
          {person.accounts.length === 0 ? (
            <p className="text-sm text-gray-600">None</p>
          ) : (
            <ul className="space-y-1">
              {person.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span>{a.rsn}</span>
                  {a.verified && <Pill tone="green">verified</Pill>}
                  {a.status !== 'active' && <Pill>{a.status}</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">
            Clans ({active.length})
          </div>
          {active.length === 0 && past.length === 0 ? (
            <p className="text-sm text-gray-600">None</p>
          ) : (
            <ul className="space-y-1">
              {active.map((m) => (
                <li key={`${m.clanId}-${m.kind}`} className="flex items-center gap-2 text-sm">
                  <span>{m.clanName}</span>
                  <Pill tone={m.kind === 'member' ? 'gold' : 'gray'}>{m.kind}</Pill>
                  {m.rank && <span className="text-xs text-gray-500">{m.rank}</span>}
                </li>
              ))}
              {past.map((m) => (
                <li key={`past-${m.clanId}`} className="flex items-center gap-2 text-sm opacity-60">
                  <span>{m.clanName}</span>
                  <Pill>left</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {person.grants.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs uppercase tracking-wide text-gray-500">Clan authority</div>
          <div className="flex flex-wrap gap-2">
            {person.grants.map((g) => (
              <Pill key={g.clanId} tone="gold">
                {g.clanName}: {g.role}
              </Pill>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-600">
            Clan roles. They grant nothing on the platform, and nothing in any other clan.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {(canWrite || canGrant) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-card-border pt-3">
          {canGrant && person.userId != null && (
            <label className="flex items-center gap-2 text-xs text-gray-400">
              Platform role
              <select
                value={person.platformRole}
                disabled={busy}
                onChange={(e) => patch({ platformRole: e.target.value })}
                className="rounded-lg border border-card-border bg-brown-dark px-2 py-1 text-xs"
              >
                {PLATFORM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          )}

          {canWrite &&
            (person.banned ? (
              <button
                onClick={() => patch({ banned: false })}
                disabled={busy}
                className="rounded-lg border border-emerald-900 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/40"
              >
                Lift platform ban
              </button>
            ) : confirming ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (recorded)"
                  className="min-w-48 flex-1 rounded-lg border border-card-border bg-brown-dark px-2 py-1 text-xs"
                />
                <button
                  onClick={() => patch({ banned: true, reason })}
                  disabled={busy}
                  className="rounded-lg border border-red-900 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40"
                >
                  Ban everywhere
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-card-border px-3 py-1 text-xs text-gray-400"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-card-border px-3 py-1 text-xs text-gray-300 hover:border-red-900 hover:text-red-300"
              >
                Platform ban…
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default function PeopleClient({
  initialQuery,
  results,
  canWrite,
  canGrant,
}: {
  initialQuery: string;
  results: PersonHit[];
  canWrite: boolean;
  canGrant: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/staff/people?q=${encodeURIComponent(q)}`);
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="RSN, Discord name, or Discord id…"
          className="flex-1 rounded-xl border border-card-border bg-card-bg px-4 py-2.5 text-sm outline-none focus:border-gold"
        />
        <button type="submit" className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold">
          Search
        </button>
      </form>

      <div className="mt-6 space-y-4">
        {results.map((p) => (
          <PersonCard
            key={p.playerId}
            person={p}
            canWrite={canWrite}
            canGrant={canGrant}
            onChanged={() => router.refresh()}
          />
        ))}
        {initialQuery && results.length === 0 && (
          <p className="text-sm text-gray-500">Nobody matches that.</p>
        )}
        {!initialQuery && (
          <p className="text-sm text-gray-500">
            Search by any name they are known by. An RSN and a Discord handle resolve to the same
            person, which is the point — a clan reports one and a Discord report names the other.
          </p>
        )}
      </div>
    </div>
  );
}
