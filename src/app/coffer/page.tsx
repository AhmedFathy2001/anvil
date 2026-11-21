import { and, eq, isNull } from 'drizzle-orm';
import { viewerIsClanInsider } from '@/lib/clanInsider';
import { cofferName, donorBoard } from '@/lib/cofferView';
import { requireFeature } from '@/lib/clanFeatures';

import { clanRoster } from '@/db/schema';
import { rosterClanSeat } from '@/lib/seatScope';
import { verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { creatorPublicAway } from '@/lib/creatorGuard';
import { getCofferBalance, listCofferEntries, topDonors } from '@/lib/coffer';
import { findRosterSeats, seatsOwnedBy } from '@/lib/roster';
import { formatGp } from '@/lib/adminEventsFormat';
import CofferDonateCard from './CofferDonateCard';
import CofferPotTabs from './CofferPotTabs';
import { getSetting } from '@/lib/settings';
import { HCW_COFFER_SETTING_KEY, type PrizeCurrency } from '@/lib/competitionGame';

export const dynamic = 'force-dynamic';

/**
 * The clan coffer, for the people who fill it.
 *
 * Public on purpose. A pot that pays out mission prizes is a promise the clan is making to itself,
 * and a promise nobody can check is worth less — so the balance, the recent movements and who has
 * put the most in are all readable, while filing a donation needs a seat.
 */
export default async function CofferPage({ searchParams }: { searchParams: Promise<{ pot?: string }> }) {
  const clan = await requireClan();
  await creatorPublicAway('/coffer', clan);
  await requireFeature(clan.id, 'coffer', '/');
  const user = await verifyUser();
  // The Hardcore Worlds pot only while the clan keeps one; a stale ?pot=hcw shows the main pot.
  const hcwCoffer = (await getSetting(clan.id, HCW_COFFER_SETTING_KEY)) === '1';
  const pot: PrizeCurrency = hcwCoffer && (await searchParams).pot === 'hcw' ? 'hcw' : 'gp';
  const hcw = pot === 'hcw';

  // Amounts are public; names are for people inside the clan (lib/cofferView).
  const insider = await viewerIsClanInsider(clan.id);
  const [balance, donors, recent] = await Promise.all([
    getCofferBalance(clan.id, pot),
    topDonors(clan.id, 8, pot).then((rows) => donorBoard(rows, insider)),
    listCofferEntries({ clanId: clan.id, statuses: ['approved', 'reserved', 'paid', 'unfunded'], limit: 20, currency: pot }),
  ]);

  // Their characters on this roster — the picker on the donate form, and the check that they hold a
  // seat here at all.
  const seats = user
    ? await findRosterSeats(
        // An event player's seat is not clan membership: no coffer.
        and(eq(clanRoster.clanId, clan.id), isNull(clanRoster.leftAt), rosterClanSeat(), await seatsOwnedBy(clan.id, user.userId)),
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <span className="w-1 h-6 bg-gold rounded-full" />
            Clan coffer
          </h1>
          <p className="text-sm text-text-muted">
            {hcw
              ? 'The clan’s Hardcore Worlds pot, in HCW gp. There is no in-game clan coffer there, so staff keep it by hand.'
              : 'The pot mission prizes are paid out of, with in-game coffer movements tracked automatically.'}
          </p>
        </div>
        {hcwCoffer && <CofferPotTabs pot={pot} />}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <p className="text-xs text-text-muted">In the pot</p>
          <p className="text-3xl font-bold text-gold">{formatGp(balance.available)}</p>
          <p className="text-[10px] text-text-muted mt-0.5">{hcw ? 'HCW gp available for prizes' : 'available for prizes'}</p>
        </div>
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <p className="text-xs text-text-muted">Won, not yet sent</p>
          <p className="text-3xl font-bold">{formatGp(balance.reserved)}</p>
          <p className="text-[10px] text-text-muted mt-0.5">already promised to winners</p>
        </div>
        <div className="border border-card-border rounded-xl bg-card-bg p-4">
          <p className="text-xs text-text-muted">Donated all time</p>
          <p className="text-3xl font-bold">{formatGp(balance.confirmed)}</p>
          <p className="text-[10px] text-text-muted mt-0.5">confirmed by staff</p>
        </div>
      </div>

      <CofferDonateCard
        key={pot}
        seats={seats.map((s) => ({ id: s.id, rsn: s.rsn }))}
        signedIn={!!user}
        hcwCoffer={hcwCoffer}
        pot={pot}
      />

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <section>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Top donors
          </h2>
          <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
            {donors.length === 0 ? (
              <p className="px-3 py-4 text-sm text-text-muted">Nobody has donated yet.</p>
            ) : (
              donors.map((d, i) => (
                <div
                  key={d.rsn ?? `donor-${i}`}
                  className="flex items-center justify-between px-3 py-2 border-b border-card-border/60 last:border-b-0"
                >
                  <span className="text-sm">
                    <span className="text-text-muted mr-2">{i + 1}.</span>
                    {d.rsn ?? 'A member'}
                  </span>
                  <span className="text-sm text-gold">{formatGp(d.total)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <span className="w-1 h-5 bg-gold rounded-full" />
            Recent movement
          </h2>
          <div className="border border-card-border rounded-xl bg-card-bg overflow-hidden">
            {recent.length === 0 ? (
              <p className="px-3 py-4 text-sm text-text-muted">Nothing has moved yet.</p>
            ) : (
              recent.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-b border-card-border/60 last:border-b-0"
                >
                  <span className="text-xs truncate">
                    <span className={e.amount >= 0 ? 'text-accent-green-light' : 'text-text-muted'}>
                      {e.amount >= 0 ? '+' : '−'}
                      {formatGp(Math.abs(e.amount))}
                    </span>{' '}
                    {e.kind === 'pool'
                      ? 'prize money for an event'
                      : e.kind === 'withdrawal'
                        ? `moved to a bank by ${cofferName(e.memberName ?? e.rsn, insider) ?? 'the clan'} (not spent)`
                      : `${e.kind === 'award' ? 'won by' : e.kind === 'donation' ? 'from' : '·'} ${
                          cofferName(e.memberName ?? e.rsn, insider) ?? 'the clan'
                        }`}
                  </span>
                  {e.status === 'unfunded' && (
                    <span className="text-[10px] text-amber-300 flex-shrink-0">pot was empty</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
