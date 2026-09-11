'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ClanRow } from '@/lib/platformView';
import type { ActAsGrant } from '@/lib/actAs';
import Select from '@/components/Select';
import { PLAN_IDS } from '@/lib/plans';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';
import { billingStatus, liveness } from '@/lib/clanBilling';
import ClanLink from '@/components/ClanLink';

const STATUSES = ['active', 'suspended', 'archived'] as const;

const STATUS_STYLE: Record<string, string> = {
  active: 'text-emerald-400',
  suspended: 'text-amber-400',
  archived: 'text-gray-500',
};

/**
 * The clan directory, with the lifecycle controls inline.
 *
 * Editing in the row rather than behind a detail page: there are four fields, and the operator is
 * nearly always comparing clans at the moment they change one.
 */
export default function ClansClient({
  clans,
  canWrite,
  grants,
}: {
  clans: ClanRow[];
  canWrite: boolean;
  grants: ActAsGrant[];
}) {
  const router = useRouter();
  const { ask } = useDialog();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // Which clan's "act as" form is open. Null means none — this is never a default-on state.
  const [acting, setActing] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(1);

  const liveByClan = new Map(grants.map((g) => [g.clanId, g]));

  // Appointing an owner is only ever offered where a clan HAS none — see the route for why that
  // restriction is the whole safety of it. Candidates are fetched on demand rather than joined into
  // every row, because this is a repair for a rare broken state, not part of the normal view.
  const [ownerFor, setOwnerFor] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<{ userId: number; role: string; name: string | null }[]>([]);

  // Verifying by hand: for a clan whose owner rank is renamed, whose owner has stopped playing, or
  // a dispute somebody has to decide. The ordinary path is an owner-tier roster push.
  async function verifyClan(clanId: number, current: string) {
    // The EXACT in-game name, which two partial unique indexes are enforced on and which roster
    // sync gates against. A browser prompt collected it with no room to say any of that.
    const name = await ask({
      title: 'Verify this clan by hand',
      body:
        'Verifying says somebody has proved this site belongs to that in-game clan. It must match the clan name in game exactly — trailing spaces and capitalisation included — because roster sync compares against it and only one verified clan may hold a name.',
      label: 'In-game clan name',
      initial: current,
      placeholder: 'The AFK Spot',
      required: true,
      confirmLabel: 'Verify',
    });
    if (name === null) return;
    setBusy(clanId);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${clanId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inGameName: name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function unverifyClan(clanId: number) {
    // This string lands in the clan's OWN history, where their staff read it. It was being typed
    // into a one-line browser prompt that accepted the empty string.
    const reason = await ask({
      title: 'Withdraw the verified badge',
      body:
        'The clan stops being able to sync a roster or enter a cross-clan leaderboard, and this reason is written into their history where their own staff will read it.',
      label: 'Why',
      placeholder: 'Disputed name — the other claimant holds the owner rank in game.',
      multiline: true,
      required: true,
      confirmLabel: 'Withdraw badge',
      tone: 'danger',
    });
    if (reason === null) return;
    setBusy(clanId);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${clanId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: false, reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function openOwner(clanId: number) {
    setOwnerFor(clanId);
    setCandidates([]);
    const res = await fetch(`/api/staff/clans/${clanId}/owner`);
    if (res.ok) setCandidates((await res.json()).candidates ?? []);
  }

  async function appointOwner(clanId: number, userId: number) {
    setBusy(clanId);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${clanId}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setOwnerFor(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function actAs(clanId: number) {
    setBusy(clanId);
    setError(null);
    try {
      const res = await fetch('/api/staff/act-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanId, reason, hours }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      setActing(null);
      setReason('');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handBack(id: number, clanId: number) {
    setBusy(clanId);
    setError(null);
    try {
      const res = await fetch('/api/staff/act-as', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/staff/clans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? clans.filter((c) =>
        // The contact email is in here because it is the one string an operator reliably HAS when a
        // customer writes in — the mail says nothing about a slug.
        // The owner's own handles are in here for the same reason: an operator following up on a
        // Discord DM or a support mail has THAT string and nothing else.
        [
          c.name,
          c.slug,
          c.host,
          c.owner ?? '',
          c.contactEmail ?? '',
          c.ownerEmail ?? '',
          c.ownerDiscordUsername ?? '',
        ].some((s) =>
          s.toLowerCase().includes(needle),
        ),
      )
    : clans;
  const now = Date.now();

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by name, slug, address, owner or email…"
        className="mb-4 rounded-xl bg-card-bg px-4 py-2.5 outline-none"
      />

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card-bg">
        <table className="w-full min-w-[68rem] text-sm">
          <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">Clan</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Subscription</th>
              <th className="px-4 py-3">Last sync</th>
              <th className="px-4 py-3 text-right">Members</th>
              <th className="px-4 py-3 text-right">Guests</th>
              <th className="px-4 py-3 text-right">Events</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Seat cap</th>
              {canWrite && <th className="px-4 py-3">Access</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {shown.map((c) => (
              <tr key={c.id} className={busy === c.id ? 'opacity-50' : undefined}>
                <td className="px-4 py-3">
                  {/* The NAME opens this clan's operator page — the question you arrive with is
                      almost always about one of them. The host below still goes to the clan's own
                      site, which is the other thing you sometimes want. */}
                  <ClanLink href={`/staff/clans/${c.id}`} className="font-medium hover:text-gold">
                    {c.name}
                  </ClanLink>
                  <div className="text-xs text-gray-500">
                    <a href={`https://${c.host}`} target="_blank" rel="noreferrer" className="hover:text-gold">
                      {c.host}
                    </a>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    {c.verified ? (
                      <span className="text-emerald-400" title={`Verified as "${c.inGameName}" in game`}>
                        ✓ {c.inGameName}
                      </span>
                    ) : (
                      <span className="text-amber-400/80" title="Nobody has proved this is a real clan — it cannot sync a roster">
                        unverified{c.inGameName ? ` · claims "${c.inGameName}"` : ''}
                      </span>
                    )}
                    {canWrite && (
                      <button
                        onClick={() => (c.verified ? unverifyClan(c.id) : verifyClan(c.id, c.inGameName ?? ''))}
                        disabled={busy != null}
                        className="text-gray-600 underline hover:text-gold"
                      >
                        {c.verified ? 'withdraw' : 'verify'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {c.owner ? (
                    /* THE NAME WAS ALL THIS SAID, which is the one thing you cannot contact somebody
                       with. The profile link opens a DM-able Discord profile; the email is the
                       fallback for an owner whose DMs are closed to strangers. Both were already on
                       `users` — the OAuth scope has always been `identify email`. */
                    <div className="flex flex-col gap-0.5">
                      {c.ownerDiscordId ? (
                        <a
                          href={`https://discord.com/users/${c.ownerDiscordId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-gold"
                          title={c.ownerDiscordUsername ? `@${c.ownerDiscordUsername} — open in Discord` : 'Open in Discord'}
                        >
                          {c.owner}
                        </a>
                      ) : (
                        c.owner
                      )}
                      {c.ownerDiscordUsername && (
                        <span className="text-xs text-gray-500">@{c.ownerDiscordUsername}</span>
                      )}
                      {c.ownerEmail && (
                        <a href={`mailto:${c.ownerEmail}`} className="text-xs text-gray-500 hover:text-gold">
                          {c.ownerEmail}
                        </a>
                      )}
                    </div>
                  ) : ownerFor === c.id ? (
                    <div className="flex flex-col gap-1">
                      {candidates.length === 0 ? (
                        <span className="text-xs text-gray-500">No staff here to promote.</span>
                      ) : (
                        candidates.map((cand) => (
                          <button
                            key={cand.userId}
                            onClick={() => appointOwner(c.id, cand.userId)}
                            disabled={busy != null}
                            className="rounded-lg border border-gold/40 px-2 py-1 text-left text-xs text-gold"
                          >
                            {cand.name ?? `#${cand.userId}`} ({cand.role})
                          </button>
                        ))
                      )}
                      <button
                        onClick={() => setOwnerFor(null)}
                        className="text-left text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-600">
                      —
                      {canWrite && (
                        <button
                          onClick={() => openOwner(c.id)}
                          className="ml-2 text-xs text-gray-500 underline hover:text-gold"
                          title="This clan has no owner, so its own transfer flow cannot give it one"
                        >
                          appoint
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400" title={c.createdAt}>
                  {/* Two timestamp formats live in these columns and only the date prefix means the
                      same thing in both (lib/dbTime) — so the date prefix is what is shown. */}
                  {c.createdAt ? c.createdAt.slice(0, 10) : '—'}
                </td>
                {(() => {
                  const b = billingStatus(c, now);
                  const l = liveness(c, now);
                  return (
                    <>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs ${
                            b.state === 'lapsed'
                              ? 'text-accent-red'
                              : b.attention
                                ? 'text-yellow-400'
                                : 'text-gray-400'
                          }`}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs tabular-nums ${l.quiet ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {l.syncDays == null ? 'never' : l.syncDays === 0 ? 'today' : `${l.syncDays}d`}
                        </span>
                      </td>
                    </>
                  );
                })()}
                <td className="px-4 py-3 text-right tabular-nums">{c.members}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400">{c.guests}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.events}</td>
                <td className="px-4 py-3">
                  {canWrite ? (
                    <Select
                      value={c.status}
                      disabled={busy != null}
                      onChange={(v) => patch(c.id, { status: v })}
                      options={STATUSES.map((s) => ({ value: s, label: s }))}
                      ariaLabel="Clan status"
                      className="w-32"
                    />
                  ) : (
                    <span className={`text-xs ${STATUS_STYLE[c.status] ?? ''}`}>{c.status}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canWrite ? (
                    <Select
                      value={c.plan}
                      disabled={busy != null}
                      onChange={(v) => patch(c.id, { plan: v })}
                      options={PLAN_IDS.map((p) => ({ value: p, label: p }))}
                      ariaLabel="Plan"
                      className="w-32"
                    />
                  ) : (
                    <span className="text-xs text-gray-300">{c.plan}</span>
                  )}
                </td>
                {/* The cap the PLAN implies is only a starting point. A clan mid-migration, one being
                    let off while something is fixed, or one on a deal that is not a tier all need a
                    number the price list does not have — so this overrides it, and empty means no cap
                    at all rather than a cap of nothing. Changing the plan resets it unless the same
                    request says otherwise, which is why this sends only the cap. */}
                <td className="px-4 py-3">
                  {canWrite ? (
                    <CapCell
                      cap={c.memberCap}
                      members={c.members}
                      disabled={busy != null}
                      onCommit={(v) => patch(c.id, { memberCap: v })}
                    />
                  ) : (
                    <span className="text-xs text-gray-300">{c.memberCap ?? 'none'}</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-3">
                    {liveByClan.has(c.id) ? (
                      <button
                        onClick={() => handBack(liveByClan.get(c.id)!.id, c.id)}
                        disabled={busy != null}
                        className="rounded-lg border border-amber-700 px-2 py-1 text-xs text-amber-300"
                        title={`until ${liveByClan.get(c.id)!.expiresAt}`}
                      >
                        Acting — hand back
                      </button>
                    ) : acting === c.id ? (
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Why (the clan sees this)"
                          className="w-56 rounded-lg px-2 py-1 text-xs"
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            max={24}
                            value={hours}
                            onChange={(e) => setHours(Number(e.target.value))}
                            className="w-14 rounded-lg px-2 py-1 text-xs"
                          />
                          <span className="text-xs text-gray-500">h</span>
                          <button
                            onClick={() => actAs(c.id)}
                            disabled={busy != null}
                            className="rounded-lg border border-gold/40 px-2 py-1 text-xs text-gold"
                          >
                            Take
                          </button>
                          <button
                            onClick={() => setActing(null)}
                            className="rounded-lg border border-card-border px-2 py-1 text-xs text-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActing(c.id);
                          setReason('');
                        }}
                        className="rounded-lg border border-card-border px-2 py-1 text-xs text-gray-400 hover:text-gold"
                      >
                        Act as…
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && <p className="mt-4 text-sm text-gray-500">No clan matches that.</p>}
    </div>
  );
}

/**
 * A cap you can type, where empty means uncapped.
 *
 * Committed on blur rather than per keystroke: a number typed a digit at a time would otherwise send
 * "1", then "15", then "150" — and the middle values are real caps that briefly put a clan over.
 */
function CapCell({
  cap,
  members,
  disabled,
  onCommit,
}: {
  cap: number | null;
  members: number;
  disabled: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(cap == null ? '' : String(cap));
  const over = cap != null && members > cap;

  function commit() {
    const t = draft.trim();
    const next = t === '' ? null : Number(t);
    if (t !== '' && (!Number.isInteger(next) || (next as number) <= 0)) {
      setDraft(cap == null ? '' : String(cap));
      return;
    }
    if (next !== cap) onCommit(next);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        placeholder="none"
        aria-label="Member cap"
        className="w-20 rounded-lg px-2 py-1 text-xs"
      />
      {over && (
        <span className="text-[10.5px] text-amber-400/80" title={`${members} seats against a cap of ${cap}`}>
          over
        </span>
      )}
    </div>
  );
}
