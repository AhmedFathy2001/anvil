'use client';

import Link from 'next/link';
import { itemIconUrl } from '@/lib/tileIcons';
import { formatMultiple, formatOdds, formatRate } from '@/lib/clogLuck';
import type { DryEntry, SpoonEntry } from '@/lib/clogProfile';

// Who the game has been cruel to, and who it hasn't. Both boards read from synced collection logs
// crossed with hiscores kill counts and the wiki's drop rates — so an entry is a claim we can show
// the working for, which is the only kind worth putting someone's name next to.

interface Props {
  dry: DryEntry[];
  spoons: SpoonEntry[];
  membersConsidered: number;
  itemsConsidered: number;
}

function Row({
  rsn,
  itemId,
  itemName,
  source,
  headline,
  detail,
  tone,
}: {
  rsn: string;
  itemId: number;
  itemName: string;
  source: string;
  headline: string;
  detail: string | null;
  tone: 'dry' | 'spoon';
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={itemIconUrl(itemId)} alt="" className="w-8 h-8 object-contain shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">
          <Link href={`/members/${encodeURIComponent(rsn)}`} className="font-medium hover:text-gold transition-colors">
            {rsn}
          </Link>
          <span className="text-text-muted"> · {itemName}</span>
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {source}
          {detail && <> · {detail}</>}
        </div>
      </div>
      <span
        className={`text-xs font-mono font-medium shrink-0 ${tone === 'dry' ? 'text-red-400' : 'text-accent-green-light'}`}
      >
        {headline}
      </span>
    </div>
  );
}

export default function ClanLuck({ dry, spoons, membersConsidered, itemsConsidered }: Props) {
  if (membersConsidered === 0) {
    return (
      <div className="border border-dashed border-card-border rounded-xl p-8 text-center">
        <p className="text-sm text-text-muted">Nobody has synced a collection log yet.</p>
        <p className="text-xs text-text-muted/70 mt-2">
          These boards need one: without a log we can&rsquo;t tell &ldquo;hasn&rsquo;t got it&rdquo; from
          &ldquo;hasn&rsquo;t told us&rdquo;. In RuneLite, the Anvil tab has a{' '}
          <span className="text-gold">Sync profile</span> button.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-text-muted">
        Drawn from {membersConsidered} synced log{membersConsidered === 1 ? '' : 's'} against{' '}
        {itemsConsidered} rare drops, using each member&rsquo;s hiscores kill count and the wiki&rsquo;s
        rates. Only bosses appear — a clue-scroll item has no kill count to be dry against.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <span className="w-1 h-5 bg-red-500 rounded-full" />
            Dry streaks
            <span className="text-xs text-text-muted font-normal">worst first</span>
          </h3>
          {dry.length === 0 ? (
            <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-xs text-text-muted">
              Nobody is past twice a drop rate. Enjoy it while it lasts.
            </div>
          ) : (
            <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
              {dry.map((e) => (
                <Row
                  key={`${e.clanMemberId}-${e.itemId}`}
                  rsn={e.rsn}
                  itemId={e.itemId}
                  itemName={e.itemName}
                  source={e.source}
                  tone="dry"
                  headline={`${formatMultiple(e.verdict.expected) ?? ''} dry`}
                  detail={[
                    `${e.verdict.kills.toLocaleString()} KC`,
                    formatRate(e.rate.denominator),
                    formatOdds(e.verdict.luckPercentile)
                      ? `only ${formatOdds(e.verdict.luckPercentile)} are still waiting`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <span className="w-1 h-5 bg-accent-green rounded-full" />
            Spoons
            <span className="text-xs text-text-muted font-normal">luckiest first</span>
          </h3>
          {spoons.length === 0 ? (
            <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-xs text-text-muted">
              Nothing yet. A spoon needs the kill count at the moment it dropped, so this fills in with
              drops that land while the plugin is watching — old unlocks can&rsquo;t be dated after
              the fact.
            </div>
          ) : (
            <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
              {spoons.map((e) => (
                <Row
                  key={`${e.clanMemberId}-${e.itemId}`}
                  rsn={e.rsn}
                  itemId={e.itemId}
                  itemName={e.itemName}
                  source={e.source}
                  tone="spoon"
                  headline={`${e.verdict.kills.toLocaleString()} KC`}
                  detail={[
                    formatRate(e.rate.denominator),
                    formatOdds(e.verdict.luckPercentile)
                      ? `${formatOdds(e.verdict.luckPercentile)} get it this early`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
