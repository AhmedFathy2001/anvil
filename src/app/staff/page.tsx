
import { notFound } from 'next/navigation';

import { platformTotals, multiClanPeople, nameCollisions, supportersInForce } from '@/lib/platformView';
import { billingStatus } from '@/lib/clanBilling';
import { clansWithHealth } from '@/lib/clanHealthDb';
import { hasPlatformRole } from '@/lib/clanRoles';
import { requirePlatformPage } from '@/lib/platformAccess';
import { pluginUsersNow } from '@/lib/pluginUsersRead';
import { applyDismissed, buildDecisions, type DecisionTone } from '@/lib/staffDecisions';
import { readDismissed } from '@/lib/staffDismissed';
import { lastOwnerMessages } from '@/lib/staffMessage';
import DismissDecision from './_components/DismissDecision';
import { staffPending } from '@/lib/staffPending';
import MessageOwnerButton from './_components/MessageOwnerButton';
import ClanLink from '@/components/ClanLink';
import { clanBasePath } from '@/lib/clanScopedPaths'; // in-game name disputes are always clans
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-2xl font-semibold text-gold">{value}</div>
      <div className="text-sm text-gray-300">{label}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="w-1 h-5 bg-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * The platform overview.
 *
 * The two numbers that matter here could not be produced at all under one-database-per-clan, and
 * they are the ones stated most plainly: how many PEOPLE use this (a human in four clans is one),
 * and how many of them are in more than one clan. The second is also the cheapest possible check
 * that the identity remodel merged rather than duplicated — if it were broken, it would read zero.
 */
export default async function StaffOverview() {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();
  const canWrite = hasPlatformRole(actor.role, 'staff');
  const now = Date.now();
  const [t, multi, collisions, { clans, health, servers }, pending, plugin, supporters, dismissed] = await Promise.all([
    platformTotals(),
    multiClanPeople(10),
    nameCollisions(),
    clansWithHealth(now),
    staffPending(),
    pluginUsersNow(now).catch(() => null),
    supportersInForce(now).catch(() => null),
    readDismissed(),
  ]);

  // WHAT IS WAITING ON A PERSON, as opposed to what the numbers say. Every one of these is a state a
  // clan can sit in indefinitely without anything failing: The AFK Spot had no owner for weeks and
  // nothing said so, because nothing was looking. A dashboard of totals is a report; this is the
  // part that is a tool (lib/staffDecisions: worst first, each with the clans it is about and why).
  const active = clans.filter((c) => c.status === 'active');
  const botMissing = new Set(servers.missing.map((m) => m.id));
  const allDecisions = buildDecisions({
    clans: active.map((c) => {
      const h = health[c.id];
      return {
        id: c.id,
        name: c.name,
        hasOwner: !!c.owner,
        verified: c.verified,
        // A creator space has no in-game clan to prove, so it can never verify.
        creator: isCreatorSpace(c),
        healthKey: h?.key ?? 'steady',
        healthReason: h?.reason ?? '',
        flags: h?.flags ?? [],
        billing: h?.billing ?? '',
        billingLabel: billingStatus(c, now).label,
        botMissing: botMissing.has(c.id),
        engaged: c.events > 0 && (h?.plugin7d ?? 0) > 0,
        ageDays: c.createdAt && !Number.isNaN(Date.parse(c.createdAt.slice(0, 10))) ? Math.max(0, Math.floor((now - Date.parse(c.createdAt.slice(0, 10))) / 86_400_000)) : null,
      };
    }),
    errors: pending.errors,
    versions: plugin?.versions ?? [],
  });
  const { open: decisions, hidden: hiddenDecisions } = applyDismissed(allDecisions, dismissed);
  const lastSent = await lastOwnerMessages([...new Set(decisions.flatMap((d) => d.clans.map((c) => c.id)))]);
  const activeThisWeek = active.filter((c) => (health[c.id]?.plugin7d ?? 0) > 0).length;
  const paying = active.filter((c) => ['active', 'cancelling'].includes(health[c.id]?.billing ?? '')).length;
  const waiting: [string, number, string][] = [
    ['Feedback to answer', pending.feedback, '/staff/feedback'],
    ['Reports', pending.reports + pending.promoReports, '/staff/reports'],
    ['Ownership transfers and shared webhooks', pending.ownershipTransfers + pending.sharedWebhooks, '/staff/ownership'],
    ['Library proposals', pending.guideProposals + pending.libraryProposals, '/staff/guides'],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Today</h1>
        <span className="text-sm text-text-muted">Every clan on this deployment. Nothing here is scoped to one.</span>
      </div>

      {/* Four numbers, each a link to where it is acted on. The rest of the totals are further down. */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/staff/clans" label="Clans with players this week" value={`${activeThisWeek} of ${active.length}`} hint="anyone on the plugin in 7 days" />
        <Kpi href="/staff/analytics?tab=plugin" label="Players on the plugin" value={plugin ? plugin.now.toLocaleString() : '—'} hint={plugin ? `playing now · ${plugin.day.toLocaleString()} in 24 hours` : 'could not be read'} />
        <Kpi href="/staff/clans" label="Paying clans" value={String(paying)} hint={`of ${active.length} active`} />
        <Kpi href="/staff/people?supporter=any" label="Supporters" value={supporters == null ? '—' : supporters.toLocaleString()} hint="memberships and gifts in force" />
      </div>

      <Section title="Needs a decision">
        {decisions.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg px-4 py-6 text-sm text-gray-300">Nothing is waiting on a decision.</p>
        ) : (
          <div className="rounded-xl border border-card-border bg-card-bg">
            {decisions.map((d) => (
              <div key={d.key} className="border-t border-card-border px-4 py-4 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DECISION_TONE[d.tone]}`}>{d.tag}</span>
                    <h3 className="text-[15px] font-semibold">{d.title}</h3>
                  </div>
                  {canWrite && <DismissDecision decisionKey={d.key} size={d.size} />}
                </div>
                <p className="mt-1 text-sm text-gray-300">{d.detail}</p>
                {d.clans.length > 0 && (
                  <ul className="mt-2.5 space-y-2">
                    {d.clans.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-sm">
                        <span className="min-w-0">
                          <ClanLink href={`/staff/clans/${c.id}`} className="font-medium text-gold-light hover:text-gold">
                            {c.name}
                          </ClanLink>
                          <span className="text-text-muted"> · {c.why}</span>
                        </span>
                        {canWrite && c.hasOwner && <MessageOwnerButton clanId={c.id} clanName={c.name} why={c.why} welcome={c.welcome} last={lastSent[c.id] ?? null} />}
                      </li>
                    ))}
                  </ul>
                )}
                {d.href && (
                  <ClanLink href={d.href} className="mt-2 inline-flex min-h-10 items-center text-sm text-gold hover:text-gold-light">
                    {d.hrefLabel ?? 'Open'}
                  </ClanLink>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {hiddenDecisions > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-text-muted">
          <span>{hiddenDecisions} dismissed. Each comes back by itself if it gets bigger.</span>
          {canWrite && <DismissDecision restore />}
        </p>
      )}

      <Section title="Waiting on you">
        <div className="grid gap-x-8 gap-y-1 rounded-xl border border-card-border bg-card-bg px-4 py-3 sm:grid-cols-2">
          {waiting.map(([label, n, href]) => (
            <ClanLink key={href} href={href} className="flex min-h-10 items-center justify-between gap-3 text-sm text-gray-200 hover:text-gold">
              <span>{label}</span>
              <b className={`tabular-nums ${n > 0 ? 'text-gold-light' : 'text-text-muted'}`}>{n}</b>
            </ClanLink>
          ))}
        </div>
      </Section>

      {/* FIRST, AND ONLY WHEN THERE IS ONE. A disputed name is the single thing on this surface
          that is waiting on a person: S6 refuses the second claimant and tells them to come here,
          and until now there was nothing here to come to. Everything below is a number to read. */}
      {collisions.length > 0 && (
        <Section title="Disputed in-game names">
          <div className="flex flex-col gap-3">
            {collisions.map((c) => (
              <div key={c.inGameName} className="rounded-xl border border-accent-red/40 bg-accent-red/[0.06] p-4">
                <div className="text-sm">
                  <span className="text-gray-400">Two clans claim </span>
                  <span className="font-medium text-gold">{c.inGameName}</span>
                </div>
                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {c.clans.map((cl) => (
                    <li key={cl.id} className="flex flex-wrap items-baseline gap-x-2.5 text-sm">
                      <ClanLink href={clanBasePath({ slug: cl.slug })} className="text-gold hover:underline">
                        {cl.name}
                      </ClanLink>
                      {cl.verified ? (
                        <span className="text-xs text-emerald-400">holds it</span>
                      ) : (
                        <span className="text-xs text-gray-500">unverified</span>
                      )}
                      {cl.refusedAttempts > 0 && (
                        <span className="text-xs text-gray-500">
                          {cl.refusedAttempts} refused claim{cl.refusedAttempts === 1 ? '' : 's'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-xs text-gray-500">
                  Decide it on the Clans tab — verify the right one by hand, or withdraw the badge.
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Reach">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="People" value={t.people} hint="humans, counted once each" />
          <Stat label="OSRS accounts" value={t.accounts} hint="mains and alts" />
          <Stat label="Roster seats" value={t.seats} hint="account × clan, currently active" />
          <Stat label="Discord logins" value={t.logins} />
        </div>
      </Section>

      <Section title="Clans">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Active" value={t.activeClans} />
          <Stat label="Suspended" value={t.suspendedClans} hint="resolves, refuses writes" />
          <Stat label="Archived" value={t.archivedClans} hint="read-only history" />
          <Stat label="Total" value={t.clans} />
        </div>
      </Section>

      <Section title="Activity">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Events" value={t.events} />
          <Stat label="Weekly competitions" value={t.competitions} />
          <Stat label="Platform-banned" value={t.bannedPeople} hint="barred everywhere" />
          <Stat label="Platform staff" value={t.platformStaff} />
        </div>
      </Section>

      <Section title="People in more than one clan">
        {multi.length === 0 ? (
          <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-gray-400">
            Nobody yet. This fills in as people turn up in a second clan — and it is the quickest
            sign that one person is being recognised as one person, rather than duplicated per clan.
          </p>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {multi.map((p) => (
              <li key={p.playerId} className="flex items-center justify-between px-4 py-2.5">
                <ClanLink href={`/staff/people?q=${encodeURIComponent(p.name ?? '')}`} className="hover:text-gold">
                  {p.name ?? `Person #${p.playerId}`}
                </ClanLink>
                <span className="text-sm text-gray-400">{p.clans} clans</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

const DECISION_TONE: Record<DecisionTone, string> = {
  broken: 'border-red-400/40 text-red-300',
  money: 'border-amber-400/40 text-amber-300',
  quiet: 'border-amber-400/40 text-amber-300',
  stuck: 'border-sky-400/40 text-sky-300',
  info: 'border-card-border text-gray-300',
};

function Kpi({ href, label, value, hint }: { href: string; label: string; value: string; hint: string }) {
  return (
    <ClanLink href={href} className="rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40">
      <div className="text-sm text-gray-300">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gold">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{hint}</div>
    </ClanLink>
  );
}
