'use client';

import { isWholeEmail } from '@/lib/staffSight';
import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ClanRow } from '@/lib/platformView';
import type { ActAsGrant } from '@/lib/actAs';
import Select from '@/components/Select';
import { planIdsFor } from '@/lib/billingCatalog';
import Input from '@/components/Input';
import { useDialog } from '@/components/Confirm';
import { billingStatus, liveness } from '@/lib/clanBilling';
import ClanLink from '@/components/ClanLink';
import { HEALTH_ORDER, inClanView, type ClanView } from '@/lib/clanHealth';
import type { ClanHealthRow } from '@/lib/clanHealthDb';
import MessageOwnerButton from '../_components/MessageOwnerButton';

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
/** Clans to a page; the views, filters and search look through all of them. */
const PAGE = 25;


const VIEWS: { key: ClanView; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'trial', label: 'Trial ending' },
  { key: 'paying', label: 'Paying' },
  { key: 'quiet', label: 'Going quiet' },
  { key: 'stuck', label: 'Never ran an event' },
  { key: 'over', label: 'Over their plan' },
];

const HEALTH_STYLE: Record<string, string> = {
  broken: 'border-red-400/40 text-red-300',
  stuck: 'border-sky-400/40 text-sky-300',
  quiet: 'border-amber-400/40 text-amber-300',
  new: 'border-card-border text-gray-300',
  steady: 'border-card-border text-gray-300',
  thriving: 'border-emerald-400/40 text-emerald-300',
};

type ClanSort = 'attention' | 'active' | 'newest' | 'members' | 'plugin' | 'name';
const SORTS: { value: ClanSort; label: string }[] = [
  { value: 'attention', label: 'Needs attention first' },
  { value: 'active', label: 'Last active' },
  { value: 'newest', label: 'Newest' },
  { value: 'members', label: 'Most members' },
  { value: 'plugin', label: 'Most on the plugin' },
  { value: 'name', label: 'Name' },
];

/** "today", "3d ago", "never": how long since anyone was seen in a clan. */
function sinceLabel(at: string | null, now: number): string {
  if (!at) return 'never';
  const t = Date.parse(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
  if (Number.isNaN(t)) return 'never';
  const d = Math.floor((now - t) / 86_400_000);
  return d <= 0 ? 'today' : `${d}d ago`;
}

export default function ClansClient({
  clans,
  health,
  canWrite,
  grants,
}: {
  clans: ClanRow[];
  /** By clan id (lib/clanHealth), worked out on the server. */
  health: Record<number, ClanHealthRow>;
  canWrite: boolean;
  grants: ActAsGrant[];
}) {
  const router = useRouter();
  const { ask } = useDialog();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<ClanView>('all');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState<ClanSort>('attention');
  const [page, setPage] = useState(0);
  /** The one clan whose controls are open under its row. */
  const [manage, setManage] = useState<number | null>(null);
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
        'The clan stops being able to sync a roster or enter a cross-clan leaderboard, and every member its roster synced becomes a guest — so the real clan can seat them. This reason is written into their history where their own staff will read it.',
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
  const matched = needle
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
  const plans = [...new Set(clans.map((c) => c.plan || 'free'))].sort();
  const viewCount = (v: ClanView) => clans.filter((c) => health[c.id] && inClanView(v, health[c.id], health[c.id].billing)).length;
  const rank = (c: ClanRow) => {
    const h = health[c.id];
    // Worst health first; within one label a flagged clan (trial ending, over its plan) leads.
    return h ? HEALTH_ORDER.indexOf(h.key) * 2 - (h.flags.length > 0 ? 1 : 0) : 99;
  };
  const stamp = (v: string | null | undefined) => (v ? Date.parse(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`) || 0 : 0);
  const filtered = matched
    .filter((c) => !health[c.id] || inClanView(view, health[c.id], health[c.id].billing))
    .filter((c) => !plan || (c.plan || 'free') === plan)
    .sort((a, b) => {
      switch (sort) {
        case 'active':
          return stamp(health[b.id]?.lastActiveAt) - stamp(health[a.id]?.lastActiveAt);
        case 'newest':
          return stamp(b.createdAt) - stamp(a.createdAt);
        case 'members':
          return b.members - a.members;
        case 'plugin':
          return (health[b.id]?.plugin7d ?? 0) - (health[a.id]?.plugin7d ?? 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return rank(a) - rank(b) || a.name.localeCompare(b.name);
      }
    });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = filtered.slice(at * PAGE, at * PAGE + PAGE);

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* The questions asked of this list, one click each; the counts are over every clan. */}
      <div role="group" aria-label="Views" className="mb-3 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => {
              setView(v.key);
              setPage(0);
            }}
            className={`min-h-10 rounded-full border px-3 text-sm transition-colors ${
              view === v.key ? 'border-gold/60 bg-gold/10 font-semibold text-gold-light' : 'border-card-border text-gray-300 hover:border-gold/40'
            }`}
          >
            {v.label} <span className="tabular-nums text-text-muted">{viewCount(v.key)}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Search by name, slug, address, owner or email…"
          className="min-w-0 flex-1 basis-64 rounded-xl bg-card-bg px-4 py-2.5 outline-none"
        />
        <Select
          ariaLabel="Plan"
          className="w-auto min-w-36"
          value={plan}
          onChange={(v) => {
            setPlan(v);
            setPage(0);
          }}
          options={[{ value: '', label: 'Any plan' }, ...plans.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))]}
        />
        <Select ariaLabel="Sort" className="w-auto min-w-52" value={sort} onChange={(v) => setSort(v as ClanSort)} options={SORTS} />
        {/* Every clan, whatever is filtered here: a file is for working on the whole list elsewhere. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file download from an API route on the apex, not a page to navigate to */}
        <a href="/api/staff/clans/export" className="inline-flex min-h-10 items-center rounded-lg border border-card-border px-3 text-sm text-gray-200 hover:border-gold/50 hover:text-gold">
          Download as a spreadsheet
        </a>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-card-border bg-card-bg">
        <table className="stack-phone w-full min-w-[54rem] text-sm">
          <thead className="border-b border-card-border text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-3 py-3">Clan</th>
              <th className="px-3 py-3">Plan</th>
              <th className="px-3 py-3">Health</th>
              <th className="px-3 py-3 text-right">Members</th>
              <th className="px-3 py-3">On the plugin, 7d</th>
              <th className="px-3 py-3 text-right">Events run</th>
              <th className="px-3 py-3">Last active</th>
              <th className="px-3 py-3">Why it is here</th>
              <th className="px-3 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {shown.map((c) => (
              <Fragment key={c.id}>
              <tr className={busy === c.id ? 'opacity-50' : undefined}>
                <td className="px-3 py-3">
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
                        className="text-gray-600 underline hover:text-gold max-sm:min-h-11 max-sm:px-2"
                      >
                        {c.verified ? 'withdraw' : 'verify'}
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {c.owner ? `owner ${c.owner}` : 'no owner'} · joined {c.createdAt ? c.createdAt.slice(0, 10) : '—'}
                  </div>
                </td>
                {(() => {
                  const b = billingStatus(c, now);
                  const h = health[c.id];
                  const share = h && c.members > 0 ? Math.min(100, Math.round((h.plugin7d / c.members) * 100)) : 0;
                  const over = c.memberCap != null && c.members > c.memberCap;
                  return (
                    <>
                      <td data-label="Plan" className="stack-third px-3 py-3">
                        <div className="capitalize text-gray-200">{(c.plan || 'free').replace(/_/g, ' ')}</div>
                        <div className={`text-xs ${b.state === 'lapsed' ? 'text-accent-red' : b.attention ? 'text-yellow-400' : 'text-text-muted'}`}>{b.label}</div>
                      </td>
                      <td data-label="Health" className="stack-third px-3 py-3">
                        {h ? (
                          <>
                            <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-bold ${HEALTH_STYLE[h.key]}`}>{h.label}</span>
                            {h.flags.includes('trial-ending') && <div className="mt-1 text-[11px] font-semibold text-amber-300">trial ending</div>}
                            {h.flags.includes('over-plan') && <div className="mt-1 text-[11px] font-semibold text-amber-300">over plan</div>}
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">unknown</span>
                        )}
                      </td>
                      <td data-label="Members" className={`stack-third px-3 py-3 text-right tabular-nums ${over ? 'text-amber-300' : ''}`}>
                        {c.members}
                        {over && <span className="text-xs"> of {c.memberCap}</span>}
                      </td>
                      <td data-label="On the plugin, 7d" className="stack-third px-3 py-3">
                        <span className="mr-2 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06] align-middle">
                          <span className="block h-full rounded-full bg-gold" style={{ width: `${share}%` }} />
                        </span>
                        <span className="tabular-nums">{h ? h.plugin7d : '—'}</span>
                      </td>
                      <td data-label="Events run" className="stack-third px-3 py-3 text-right tabular-nums">{c.events}</td>
                      <td data-label="Last active" className="stack-third px-3 py-3 text-gray-300">{h ? sinceLabel(h.lastActiveAt, now) : '—'}</td>
                      <td data-label="Why it is here" className="px-3 py-3 text-xs text-gray-300">
                        <div className="min-w-[9rem] max-w-[16rem]">{h?.reason ?? ''}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-stretch gap-1.5">
                          {canWrite && c.owner && h && inClanView('attention', h, h.billing) && <MessageOwnerButton clanId={c.id} clanName={c.name} why={h.reason} />}
                          <button
                            type="button"
                            onClick={() => setManage(manage === c.id ? null : c.id)}
                            aria-expanded={manage === c.id}
                            className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg border border-card-border px-3 text-sm text-gray-200 hover:border-gold/50 hover:text-gold"
                          >
                            {manage === c.id ? 'Close' : 'Manage'}
                          </button>
                        </div>
                      </td>
                    </>
                  );
                })()}
              </tr>
              {manage === c.id && (
                <tr className={busy === c.id ? 'opacity-50' : undefined}>
                  {/* Everything that CHANGES the clan, and how to reach its owner: out of the row, where
                      twelve columns of it hid the four that say how the clan is doing. */}
                  <td colSpan={9} className="border-t border-card-border/60 bg-black/20 px-4 py-4">
                    <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Owner</div>
                      <div className="text-gray-300">
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
                      {c.ownerEmail &&
                        (isWholeEmail(c.ownerEmail) ? (
                          <a href={`mailto:${c.ownerEmail}`} className="text-xs text-gray-500 hover:text-gold">
                            {c.ownerEmail}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-500">{c.ownerEmail}</span>
                        ))}
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
                          className="ml-2 text-xs text-gray-500 underline hover:text-gold max-sm:min-h-11 max-sm:px-2"
                          title="This clan has no owner, so its own transfer flow cannot give it one"
                        >
                          appoint
                        </button>
                      )}
                    </span>
                  )}
                      </div>
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Status</div>
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
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Plan</div>
                  {canWrite ? (
                    <Select
                      value={c.plan}
                      disabled={busy != null}
                      onChange={(v) => patch(c.id, { plan: v })}
                      // Only its own catalogue's tiers: a creator space is never offered a clan one.
                      options={planIdsFor(c.kind).map((p) => ({ value: p, label: p }))}
                      ariaLabel="Plan"
                      className="w-32"
                    />
                  ) : (
                    <span className="text-xs text-gray-300">{c.plan}</span>
                  )}
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Seat cap</div>
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
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Roster</div>
                        <div className="text-gray-300">
                          {c.members} members · {c.guests} guests · last sync{' '}
                          {(() => {
                            const l = liveness(c, now);
                            return <span className={l.quiet ? 'text-yellow-400' : ''}>{l.syncDays == null ? 'never' : l.syncDays === 0 ? 'today' : `${l.syncDays}d ago`}</span>;
                          })()}
                        </div>
                      </div>
                      {canWrite && (
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Access</div>
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
                          className="w-56 max-w-full rounded-lg px-2 py-1 text-xs"
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
                      </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
        <span>
          {filtered.length === 0
            ? 'No clans match.'
            : `${at * PAGE + 1} to ${Math.min(filtered.length, at * PAGE + PAGE)} of ${filtered.length}${filtered.length < clans.length ? ` (${clans.length} clans in all)` : ''}`}
        </span>
        {pages > 1 && (
          <span className="flex gap-2">
            <button type="button" disabled={at === 0} onClick={() => setPage(at - 1)} className="min-h-10 rounded-lg border border-card-border px-3 text-gray-200 disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={at >= pages - 1} onClick={() => setPage(at + 1)} className="min-h-10 rounded-lg border border-card-border px-3 text-gray-200 disabled:opacity-40">
              Next
            </button>
          </span>
        )}
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
