'use client';

import { useState } from 'react';
import Select from '@/components/Select';
import { useRouter } from 'next/navigation';

import type { PersonHit } from '@/lib/platformView';
import Input from '@/components/Input';

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
  viewerPlayerId,
  onChanged,
}: {
  person: PersonHit;
  canWrite: boolean;
  canGrant: boolean;
  /** The viewer's own person id — their row must not offer what the API will refuse. */
  viewerPlayerId: number | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  // YOUR OWN ROW. The API refuses both of these against yourself, and a control that always errors
  // is worse than no control: it reads as a thing you may do that happens to be broken.
  const isSelf = viewerPlayerId != null && viewerPlayerId === person.playerId;
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
            Clans ({person.clans.length})
          </div>
          {person.clans.length === 0 ? (
            <p className="text-sm text-gray-600">None</p>
          ) : (
            <ul className="space-y-2.5">
              {person.clans.map((c) => (
                <li key={c.clanId} className="text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{c.clanName}</span>
                    {/* Authority sits WITH the clan rather than in a list of its own. Kept apart, a
                        clan somebody runs without a roster seat — ordinary for staff — showed up
                        under authority and nowhere else, as if they had no involvement with it. */}
                    {c.grant && <Pill tone="gold">{c.grant}</Pill>}
                    {c.seats.length === 0 && <span className="text-xs text-gray-600">no roster seat</span>}
                  </span>

                  {/* ONE LINE PER CHARACTER. A seat is (account × clan), so three characters in one
                      clan is three seats — and they used to render as three identical rows naming
                      the clan and nothing else. */}
                  {c.seats.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {c.seats.map((seat) => (
                        <li
                          key={`${seat.rsn}-${seat.kind}`}
                          className={`flex flex-wrap items-center gap-2 text-xs ${seat.left ? 'opacity-50' : ''}`}
                        >
                          <span className="text-gray-300">{seat.rsn}</span>
                          <Pill tone={seat.kind === 'member' ? 'gold' : 'gray'}>{seat.kind}</Pill>
                          {seat.rank && <span className="text-gray-500">{seat.rank}</span>}
                          {seat.left && <Pill>left</Pill>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {person.clans.some((c) => c.grant) && (
        <p className="mt-3 text-xs text-gray-600">
          Clan roles grant nothing on the platform, and nothing in any other clan.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {(canWrite || canGrant) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-card-border pt-3">
          {isSelf && (
            <span className="text-xs text-gray-500">
              Your own row. A platform role and a ban are both changed by another operator — banning
              yourself would sign you out with no way back to this page.
            </span>
          )}

          {!isSelf && canGrant && person.userId != null && (
            <label className="flex items-center gap-2 text-xs text-gray-400">
              Platform role
              <Select
                value={person.platformRole}
                disabled={busy}
                onChange={(v) => patch({ platformRole: v })}
                options={PLATFORM_ROLES.map((r) => ({ value: r, label: r }))}
                ariaLabel="Platform role"
                className="w-32"
              />
            </label>
          )}

          {!isSelf &&
            canWrite &&
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
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (recorded)"
                  className="min-w-48 flex-1 rounded-lg px-2 py-1 text-xs"
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
  viewerPlayerId,
}: {
  initialQuery: string;
  results: PersonHit[];
  canWrite: boolean;
  canGrant: boolean;
  /** The viewer's own person id — their row must not offer what the API will refuse. */
  viewerPlayerId: number | null;
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
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="RSN, Discord name, or Discord id…"
          className="flex-1 rounded-xl bg-card-bg px-4 py-2.5 outline-none"
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
            viewerPlayerId={viewerPlayerId}
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
