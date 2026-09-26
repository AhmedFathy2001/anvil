'use client';

import { useCallback, useState } from 'react';
import Select from '@/components/Select';
import { useRouter } from 'next/navigation';

import type { PersonHit, PeopleBrowseRow, PeopleSort } from '@/lib/platformView';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';
import MergePeopleDialog from './MergePeopleDialog';

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
  onMerge,
}: {
  person: PersonHit;
  canWrite: boolean;
  canGrant: boolean;
  /** The viewer's own person id — their row must not offer what the API will refuse. */
  viewerPlayerId: number | null;
  onChanged: () => void;
  onMerge: (person: PersonHit) => void;
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
        {person.platformGuideEditor && <Pill tone="gold">guide editor</Pill>}
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

          {canGrant && person.userId != null && (
            // Lateral to the role: writes the Anvil guide library and nothing else on the platform.
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={person.platformGuideEditor}
                disabled={busy}
                onChange={(e) => patch({ platformGuideEditor: e.target.checked })}
                className="accent-[#e0b341]"
              />
              Library guide editor
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

          {!isSelf && canWrite && (
            <button
              onClick={() => onMerge(person)}
              className="rounded-lg border border-card-border px-3 py-1 text-xs text-gray-300 hover:border-gold/40 hover:text-gold"
            >
              Merge duplicate…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PeopleClient({
  initialQuery,
  results,
  browse,
  filters,
  clans,
  canWrite,
  canGrant,
  viewerPlayerId,
}: {
  initialQuery: string;
  results: PersonHit[];
  browse: { rows: PeopleBrowseRow[]; total: number; page: number; pages: number };
  filters: {
    clanId: string;
    login: string;
    accounts: string;
    banned: string;
    multiClan: boolean;
    sort: PeopleSort;
  };
  clans: { id: number; name: string }[];
  canWrite: boolean;
  canGrant: boolean;
  /** The viewer's own person id — their row must not offer what the API will refuse. */
  viewerPlayerId: number | null;
}) {
  const router = useRouter();
  const { notify } = useDialog();
  const [q, setQ] = useState(initialQuery);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<PersonHit | null>(null);

  const closeMerge = useCallback(() => {
    setMergeOpen(false);
    setMergeSource(null);
  }, []);

  function openMerge(source: PersonHit | null = null) {
    setMergeSource(source);
    setMergeOpen(true);
  }

  const merged = useCallback((message: string) => {
    closeMerge();
    notify(message);
    router.refresh();
  }, [closeMerge, notify, router]);

  // One URL builder for the search box, every filter and the pager, so changing one never silently
  // drops the others — which is the usual way a filtered list becomes untrustworthy.
  function go(next: Partial<Record<string, string | number | boolean | null>>) {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | boolean | null> = {
      q,
      clan: filters.clanId,
      login: filters.login,
      accounts: filters.accounts,
      banned: filters.banned,
      multi: filters.multiClan,
      sort: filters.sort,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v === '' || v === false || v == null) continue;
      if (k === 'sort' && v === 'connected') continue;
      p.set(k, String(v));
    }
    router.push(`/staff/people?${p.toString()}`);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    go({ page: null });
  }

  function clearFilters() {
    setQ('');
    go({
      q: '',
      clan: '',
      login: '',
      accounts: '',
      banned: '',
      multi: false,
      sort: 'connected',
      page: null,
    });
  }

  const hasActiveFilters = Boolean(
    initialQuery ||
    filters.clanId ||
    filters.login ||
    filters.accounts ||
    filters.banned ||
    filters.multiClan ||
    filters.sort !== 'connected',
  );

  const pager = browse.pages > 1 && (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <button
        disabled={browse.page <= 1}
        onClick={() => go({ page: browse.page - 1 })}
        className="rounded-lg border border-card-border px-2.5 py-1 disabled:opacity-40"
      >
        ← Previous
      </button>
      <span className="text-gray-500">Page {browse.page} of {browse.pages}</span>
      <button
        disabled={browse.page >= browse.pages}
        onClick={() => go({ page: browse.page + 1 })}
        className="rounded-lg border border-card-border px-2.5 py-1 disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <form onSubmit={search} className="flex min-w-0 flex-1 gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="RSN, Discord name, #person-id, or Discord id…"
            className="min-w-0 flex-1 rounded-xl bg-card-bg px-4 py-2.5 outline-none"
          />
          <button type="submit" className="rounded-xl border border-gold/40 px-4 py-2.5 text-sm text-gold">
            Search
          </button>
        </form>
        {canWrite && (
          <button
            type="button"
            onClick={() => openMerge()}
            className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-brown-dark hover:bg-gold-light"
          >
            Merge people…
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-5">
        <Select
          value={filters.clanId}
          onChange={(v) => go({ clan: v, page: null })}
          options={[{ value: '', label: 'Any clan' }, ...clans.map((c) => ({ value: String(c.id), label: c.name }))]}
          ariaLabel="Clan"
          className="w-full"
        />
        <Select
          value={filters.login}
          onChange={(v) => go({ login: v, page: null })}
          options={[
            { value: '', label: 'Any login state' },
            { value: 'yes', label: 'Has signed in' },
            { value: 'no', label: 'Never signed in' },
          ]}
          ariaLabel="Login state"
          className="w-full"
        />
        <Select
          value={filters.accounts}
          onChange={(v) => go({ accounts: v, page: null })}
          options={[
            { value: '', label: 'Any character state' },
            { value: 'yes', label: 'Has characters' },
            { value: 'no', label: 'No characters' },
          ]}
          ariaLabel="Character state"
          className="w-full"
        />
        <Select
          value={filters.banned}
          onChange={(v) => go({ banned: v, page: null })}
          options={[
            { value: '', label: 'Any ban state' },
            { value: 'yes', label: 'Platform-banned' },
            { value: 'no', label: 'Not platform-banned' },
          ]}
          ariaLabel="Platform ban state"
          className="w-full"
        />
        <Select
          value={filters.sort}
          onChange={(v) => go({ sort: v, page: null })}
          options={[
            { value: 'connected', label: 'Most connected' },
            { value: 'name_asc', label: 'Name A–Z' },
            { value: 'name_desc', label: 'Name Z–A' },
            { value: 'newest', label: 'Newest people' },
            { value: 'oldest', label: 'Oldest people' },
            { value: 'accounts_desc', label: 'Most characters' },
            { value: 'clans_desc', label: 'Most clans' },
          ]}
          ariaLabel="Sort people"
          className="w-full"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5 text-text-muted">
          <input type="checkbox" checked={filters.multiClan} onChange={(e) => go({ multi: e.target.checked, page: null })} />
          In more than one clan
        </label>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-gray-400 underline underline-offset-2 hover:text-gold">
            Clear search and filters
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-xs text-gray-500">
          {browse.total.toLocaleString()} {browse.total === 1 ? 'person' : 'people'}
          {browse.pages > 1 && ` · page ${browse.page} of ${browse.pages}`}
        </div>

        {!initialQuery ? (
          <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-2.5">Person</th>
                  <th className="px-4 py-2.5 text-right">Characters</th>
                  <th className="px-4 py-2.5 text-right">Clans</th>
                  <th className="px-4 py-2.5">Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {browse.rows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-brown-light/40">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => go({ q: `#${row.playerId}`, page: null })}
                        className="text-left font-medium hover:text-gold"
                      >
                        {row.name ?? `Person #${row.playerId}`}
                      </button>
                      <span className="ml-2 text-xs text-gray-600">#{row.playerId}</span>
                      {row.banned && <span className="ml-2"><Pill tone="red">banned</Pill></span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.accounts}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.clans}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{row.hasLogin ? 'Discord' : '—'}</td>
                  </tr>
                ))}
                {browse.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      Nobody matches those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((person) => (
              <PersonCard
                key={person.playerId}
                person={person}
                canWrite={canWrite}
                canGrant={canGrant}
                viewerPlayerId={viewerPlayerId}
                onChanged={() => router.refresh()}
                onMerge={openMerge}
              />
            ))}
            {results.length === 0 && (
              <p className="rounded-xl border border-card-border bg-card-bg px-4 py-6 text-center text-sm text-gray-500">
                Nobody matches “{initialQuery}” with those filters.
              </p>
            )}
          </div>
        )}
        {pager}
      </div>

      {mergeOpen && (
        <MergePeopleDialog
          initialSource={mergeSource}
          viewerPlayerId={viewerPlayerId}
          onClose={closeMerge}
          onMerged={merged}
        />
      )}
    </div>
  );
}
