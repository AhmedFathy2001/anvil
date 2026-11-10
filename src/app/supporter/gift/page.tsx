import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { GIFT_LENGTHS, GIVER_RANKS, giftPriceUsd } from '@/lib/supporterGiftPurchase';
import { giftCheckoutConfigured } from '@/lib/supporterGiftCheckout';
import { SUPPORTER_TIERS, SUPPORTER_TIER_ORDER } from '@/lib/supporterTiers';
import GiftForm from './GiftForm';

export const metadata: Metadata = { title: 'Gift Anvil Supporter', robots: { index: false } };

/** Buy Supporter time for someone else: once, no renewal, straight onto their account. */
export default async function GiftPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isApexHost((await headers()).get('host'))) notFound();
  const session = await verifyUser();
  const to = (await searchParams).to;
  const initial = typeof to === 'string' ? to.slice(0, 12) : '';
  const open = giftCheckoutConfigured();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-gold/85">Anvil Supporter</p>
      <h1 className="display mt-2 text-3xl font-semibold">Gift Supporter to someone</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-muted">
        Buy a clanmate (or anyone on Anvil) Supporter time. You pay once and it never renews. It lands on their
        account the moment the payment clears, and every month you give counts toward your giver rank.
      </p>

      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-5">
        {!session ? (
          <ClanLink
            href={`/login?return=${encodeURIComponent(`/supporter/gift${initial ? `?to=${encodeURIComponent(initial)}` : ''}`)}`}
            className="inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light"
          >
            Sign in to gift
          </ClanLink>
        ) : open ? (
          <GiftForm initial={initial} />
        ) : (
          <p className="text-sm text-text-muted">Gifts open soon.</p>
        )}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-card-bg">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-text-muted">Gift</th>
              {GIFT_LENGTHS.map((m) => (
                <th key={m} className="px-4 py-2.5 font-semibold">
                  {m === 12 ? '1 year' : `${m} month${m === 1 ? '' : 's'}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUPPORTER_TIER_ORDER.map((t) => (
              <tr key={t} className="border-t border-card-border">
                <th scope="row" className="px-4 py-2.5 font-medium text-gold-light">
                  {SUPPORTER_TIERS[t].name}
                </th>
                {GIFT_LENGTHS.map((m) => (
                  <td key={m} className="px-4 py-2.5 font-mono tabular-nums">
                    ${giftPriceUsd(t, m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Giver ranks</h2>
        <p className="mt-1 text-[13px] text-text-muted">Counted in months given, never money. Shown on your name and on the supporters wall.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {GIVER_RANKS.map((r) => (
            <li key={r.id} className="rounded-full border border-card-border bg-card-bg px-3 py-1 text-[13px]">
              <span className="font-semibold text-[#ff7ab8]">{r.name}</span>
              <span className="text-text-muted"> · {r.months} month{r.months === 1 ? '' : 's'} given</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-6 text-[12px] text-text-dim">
        A gift is flair and hosting room for its length. It doesn&rsquo;t add to their own tenure (that counts the time they
        pay for themselves) and it doesn&rsquo;t give clan boost slots.
      </p>
    </div>
  );
}
