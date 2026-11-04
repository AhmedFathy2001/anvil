import { cookies, headers } from 'next/headers';
import { REFERRAL_COOKIE } from '@/lib/referrals';
import { isReferralCode } from '@/lib/referralRules';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { db } from '@/db';
import { users } from '@/db/schema';
import { isApexHost } from '@/lib/clanContext';
import { FRIENDS_CAPS } from '@/lib/friendEventRules';
import { verifyUser } from '@/lib/auth';
import { ensureSupporterRef, supporterCheckoutUrl, supporterForUser } from '@/lib/supporter';
import { BOOST_SLOTS, boostSlotsFor } from '@/lib/clanBoosts';
import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER, type SupporterTierId } from '@/lib/supporterTiers';
import AnvilMark from '@/components/AnvilMark';
import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anvil Supporter',
  description: 'Support Anvil and stand out to your clan: name flair on boards, the plugin panel and Discord, from $1 a month.',
};

type Cell = string | { text: string; soon?: boolean };

/**
 * What each tier gets. A perk that isn't built yet says so: this page must never sell something a
 * buyer can't use today. Flip `soon` off as each phase ships.
 */
const ROWS: { label: string; hint?: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: 'Name flair on Anvil', cells: ['—', 'Gold name + star', 'Pick a gradient', 'Animated, any colours you like'] },
  { label: 'Flair in the plugin panel and on Discord', cells: ['—', 'Gold name + star', 'Gradient name + star', 'Gradient name + star'] },
  { label: 'Gold GZ on clanmates’ drops (plugin)', cells: ['GZ', 'Gold GZ', 'Gold GZ', 'Gold GZ'] },
  { label: 'Animated avatar and banner', cells: ['—', '—', 'Yes', 'Yes'] },
  { label: 'Display case of your best drops', cells: ['—', '4 slots', '8 slots', '12 slots'] },
  {
    label: 'Host friend events',
    hint: 'Run your own private bingo or race for friends, tracked by the plugin like a clan event. Friends join by your invite link. Shown as how many can be running at once, and how many players they can hold between them while they overlap.',
    cells: ['Join only', ...SUPPORTER_TIER_ORDER.map((id) => friendsCell(id))] as [Cell, Cell, Cell, Cell],
  },
  {
    label: 'Clan boosts',
    hint: 'Put a boost on a clan you are a member of. Enough boosts from its members give the clan a badge, a coloured name, a better spot in the Clan Hall and more. Looks only, never a rank or a score. Comes with paid membership, not with time earned through invites.',
    cells: ['—', ...SUPPORTER_TIER_ORDER.map((id) => (BOOST_SLOTS[id] ? `${BOOST_SLOTS[id]} slot${BOOST_SLOTS[id] === 1 ? '' : 's'}` : '—'))] as [Cell, Cell, Cell, Cell],
  },
  {
    label: 'Head-to-head challenges',
    hint: 'Challenge a friend one on one: first to a drop, or most kills or XP in a set time. Anvil tracks you both and calls the winner. Just for bragging rights, never for stakes.',
    cells: ['1 active', '5 active', 'Unlimited', 'Unlimited'] },
];

/** "1 at a time · 10 players", from the one table the gates read (lib/friendEventRules). */
function friendsCell(id: SupporterTierId): Cell {
  const c = FRIENDS_CAPS[id];
  return `${c.liveEvents} at a time · ${c.playersPerEvent} players`;
}

export default async function SupporterPage() {
  if (!isApexHost((await headers()).get('host'))) notFound();

  const session = await verifyUser();
  const current = session ? await supporterForUser(session.userId) : null;
  // Paid slots only (invite time has none), for the one line that says they can boost.
  const boostSlots = current && session ? (await boostSlotsFor(session.userId).catch(() => ({ slots: 0 }))).slots : 0;
  const viaCookie = (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
  const via = isReferralCode(viaCookie) ? viaCookie : null;
  const checkout = session ? supporterCheckoutUrl(await ensureSupporterRef(session.userId), via) : null;
  // The name people see on their card, for the preview (the session's username is a login handle).
  const me = session
    ? (await db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { displayName: true } }))?.displayName ?? null
    : null;
  const configured = !!process.env.GUMROAD_URL_SUPPORTER;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <header className="relative mb-10 overflow-hidden text-center">
        <AnvilMark
          size={200}
          className="pointer-events-none absolute -top-12 left-1/2 hidden -translate-x-1/2 text-gold/[0.04] sm:block"
        />
        <p className="relative font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Anvil Supporter</p>
        <h1 className="display display-lg relative mt-2 text-[clamp(1.8rem,4vw,2.4rem)] font-semibold [text-wrap:balance]">
          Support Anvil. Stand out to your clan.
        </h1>
        <p className="relative mx-auto mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-text-muted">
          Anvil is an indie project, and every clan event, drop and leaderboard runs on servers that cost
          money each month. Supporters are what keep it running and free for every clan. In return you
          get flair your clanmates can see and more room to host.
        </p>
        <p className="relative mx-auto mt-2 max-w-[56ch] text-[13.5px] text-text-dim">
          Tracking, events, scoring and your own stats stay free for everyone. No in-game items, no
          advantage, nothing random.
        </p>
        {current && (
          // One flex row: the flair is an inline-flex box (star + name), which sits on its own bottom
          // edge instead of the text baseline, so the words around it have to be flex items too.
          <p className="relative mx-auto mt-4 flex w-fit items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[13px] leading-5">
            <span>You&rsquo;re an</span>
            <SupporterName name={`Anvil ${current.tier.name}`} tier={current.tier.id} style={current.style} className="font-semibold" plain />
            <span className="-ml-1">. Thank you.</span>
          </p>
        )}
        {current && (
          <p className="relative mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13.5px]">
            <ClanLink href="/host/friends" className="text-gold hover:text-gold-light">
              Host an event for your friends →
            </ClanLink>
            {boostSlots > 0 && (
              <ClanLink href="/settings/boosts" className="text-gold hover:text-gold-light">
                You have {boostSlots} boost{boostSlots === 1 ? '' : 's'}. Boost any clan you&rsquo;re a member of →
              </ClanLink>
            )}
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {SUPPORTER_TIER_ORDER.map((id) => (
          <TierCard
            key={id}
            id={id}
            current={current?.tier.id === id}
            signedIn={!!session}
            me={me}
            checkout={configured ? checkout : null}
          />
        ))}
      </div>

      <div className="mt-10 overflow-x-auto overflow-y-hidden rounded-xl border border-card-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-card-bg">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-muted">What you get</th>
              <th className="px-4 py-3 font-semibold">Free</th>
              {SUPPORTER_TIER_ORDER.map((id) => (
                <th key={id} className="px-4 py-3 font-semibold text-gold-light">
                  {SUPPORTER_TIERS[id].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-card-border">
                <th scope="row" className="px-4 py-3 font-medium">
                  {row.hint ? <Hint label={row.label} hint={row.hint} /> : row.label}
                </th>
                {row.cells.map((c, i) => {
                  const cell = typeof c === 'string' ? { text: c } : c;
                  return (
                    <td key={i} className={`px-4 py-3 ${cell.text === '—' ? 'text-text-dim' : 'text-text-muted'}`}>
                      {cell.text}
                      {cell.soon && (
                        <span className="ml-1.5 rounded-full border border-card-border px-1.5 py-px text-[10px] uppercase tracking-wider text-text-dim">
                          Soon
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-[13px] text-text-dim">
        Billed through Gumroad. Cancel any time and your perks last to the end of the term you paid for.
        Yearly plans get two months free.
      </p>
    </div>
  );
}

function TierCard({
  id,
  current,
  signedIn,
  me,
  checkout,
}: {
  id: SupporterTierId;
  current: boolean;
  signedIn: boolean;
  /** The viewer's own name, previewed in this tier's flair. */
  me: string | null;
  checkout: string | null;
}) {
  const t = SUPPORTER_TIERS[id];
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-5 ${current ? 'border-gold/60 bg-gold/[0.06]' : 'border-card-border bg-card-bg'}`}
    >
      <SupporterName name={t.name} tier={id} className="text-lg font-bold" plain />
      <div>
        <span className="font-mono text-3xl font-bold tabular-nums">${t.yearlyUsd}</span>
        <span className="ml-1 text-sm text-text-muted">a year</span>
        <p className="mt-0.5 text-[13px] text-text-dim">or ${t.monthlyUsd} a month</p>
      </div>
      {me && (
        <div className="rounded-lg border border-card-border bg-background/40 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">On your card</p>
          <SupporterName name={me} tier={id} className="mt-1 max-w-full font-semibold" plain />
        </div>
      )}
      {current ? (
        <span className="mt-auto rounded-lg border border-gold/40 px-3 py-2 text-center text-sm font-medium text-gold">
          Your tier
        </span>
      ) : !signedIn ? (
        <ClanLink
          href={`/login?return=${encodeURIComponent('/supporter')}`}
          className="mt-auto rounded-lg bg-gold px-3 py-2 text-center text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Sign in to support
        </ClanLink>
      ) : checkout ? (
        <a
          // eslint-disable-next-line clan-scope/clan-prefix -- external Gumroad checkout, never a clan path
          href={checkout}
          className="mt-auto rounded-lg bg-gold px-3 py-2 text-center text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Choose {t.name}
        </a>
      ) : (
        <span className="mt-auto rounded-lg border border-card-border px-3 py-2 text-center text-sm text-text-dim">
          Opening soon
        </span>
      )}
    </div>
  );
}

/** A row label with its explanation on hover or keyboard focus (CSS only; this page is a server component). */
function Hint({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="group relative inline-flex items-center gap-1.5">
      <span tabIndex={0} className="cursor-help underline decoration-text-dim decoration-dotted underline-offset-4 outline-none">
        {label}
      </span>
      <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-card-border text-[10px] text-text-dim">
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-20 mt-1.5 w-72 rounded-lg border border-card-border bg-background px-3 py-2 text-[12.5px] font-normal leading-snug text-text-muted opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}
