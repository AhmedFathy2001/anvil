import type { Metadata } from 'next';

import ClanFundProgress from '@/components/ClanFundProgress';
import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { requireClan } from '@/lib/clanContext';
import { fundConfigured, fundView } from '@/lib/clanFund';
import { fundCheckoutUrl } from '@/lib/clanFundRules';
import { creatorPublicAway } from '@/lib/creatorGuard';
import { db } from '@/db';
import { clans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ensureSupporterRef } from '@/lib/supporter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Clan fund' };

/**
 * The clan fund, for members (lib/clanFund): the plan the owner is funding, how far chip-ins have
 * come, and one button to chip in. A chip-in is a yearly Gumroad membership from $6 that renews until
 * they cancel. Nothing here says who gave what.
 */
export default async function FundPage() {
  const clan = await requireClan();
  await creatorPublicAway('/fund', clan);
  const row = await db.query.clans.findFirst({ where: eq(clans.id, clan.id), columns: { id: true, name: true, fundPlan: true, fundFunded: true, fundShortSince: true } });
  const view = row ? await fundView(row) : null;
  const session = await verifyUser();
  const configured = fundConfigured();
  const chipUrl =
    view && configured && !view.totals.funded
      ? fundCheckoutUrl(process.env.GUMROAD_URL_CLAN_FUND, await ensureClanCheckoutRef(clan.id), session ? await ensureSupporterRef(session.userId) : null)
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-[13px] text-text-muted">{clan.name} · clan fund</p>
      {!view ? (
        <>
          <h1 className="mt-1 text-3xl font-semibold">No fund running</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-text-muted">This clan isn&rsquo;t collecting for a plan right now.</p>
        </>
      ) : (
        <>
          <h1 className="mt-1 text-3xl font-semibold text-gold">Keep the clan on {view.planName}</h1>
          <section className="mt-6 flex flex-col gap-4 rounded-xl border border-gold/45 bg-card-bg p-5">
            <p className="text-[14px] leading-relaxed text-text-muted">
              {view.planName} lets the clan keep more members on Anvil. If you&rsquo;d like to help pay for it, chip in once a year. It&rsquo;s
              optional, and nothing in the clan depends on it.
            </p>
            <ClanFundProgress planName={view.planName} totals={view.totals} graceEndsAt={view.granted && !view.totals.funded ? view.graceEndsAt : null} />
            {view.totals.funded ? (
              <p className="rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-[13.5px] text-accent-green-light">Fully funded. Thank you to everyone who chipped in.</p>
            ) : chipUrl ? (
              <>
                <a
                  href={chipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-gold px-5 text-[15px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
                >
                  Chip in on Gumroad (from $6)
                </a>
                <p className="text-[12.5px] leading-relaxed text-text-muted">
                  A yearly membership on Gumroad: you pick the amount, it renews once a year until you cancel, and you can cancel any time
                  from Gumroad.
                  {!session && (
                    <>
                      {' '}
                      <ClanLink href="/login?return=/fund" className="text-gold hover:text-gold-light">
                        Sign in
                      </ClanLink>{' '}
                      first if you want it linked to your account.
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-muted">Chipping in isn&rsquo;t open yet.</p>
            )}
          </section>
          <p className="mt-4 text-[12.5px] text-text-muted">The clan never sees how much anyone gave.</p>
        </>
      )}
    </div>
  );
}
