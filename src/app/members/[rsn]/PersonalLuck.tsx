import { itemIconUrl } from '@/lib/tileIcons';
import { formatCount, formatNet, formatOdds, type LuckTotal } from '@/lib/clogLuck';
import { formatSources, type LuckRateSource } from '@/lib/clogProfile';

// One member's luck, as a single answer to the question people actually ask: am I dry?
//
// The headline is a COUNT of drops, not a score out of a hundred, because that is the unit the
// question is asked in — "I'm owed three more Zenytes" is a sentence a clan says out loud, and
// "your luck is 38" is not. The percentile sits underneath as the context for it.

export interface LuckItemView {
  itemId: number;
  itemName: string;
  page: string;
  sources: LuckRateSource[];
  kills: number;
  expected: number;
  obtained: number;
  tail: number;
}

export interface PersonalLuckProps {
  total: LuckTotal;
  dry: LuckItemView[];
  spooned: LuckItemView[];
}

const VERDICT = {
  dry: { label: 'Dry', tone: 'text-red-400', bar: 'bg-red-400' },
  'on-rate': { label: 'On rate', tone: 'text-text-muted', bar: 'bg-gold' },
  spooned: { label: 'Spooned', tone: 'text-accent-green', bar: 'bg-accent-green' },
} as const;

function ItemRow({ item, tone }: { item: LuckItemView; tone: 'dry' | 'spoon' }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <img src={itemIconUrl(item.itemId)} alt="" width={28} height={28} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-foreground truncate">{item.itemName}</div>
        <div className="text-[11px] text-text-muted/80 truncate">
          {item.page} · {item.kills.toLocaleString()} KC · {formatSources(item.sources)}
        </div>
      </div>
      <div className={`text-[11px] shrink-0 tabular-nums ${tone === 'dry' ? 'text-red-400' : 'text-accent-green'}`}>
        {formatCount(item.obtained, item.expected)}
      </div>
    </li>
  );
}

export default function PersonalLuck({ total, dry, spooned }: PersonalLuckProps) {
  // Nothing to say about a log with no tracked kills behind it — better silent than a made-up score.
  if (total.items === 0 || total.expected <= 0) return null;
  const verdict = VERDICT[total.verdict];
  const odds = formatOdds(total.tail);

  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h3 className="font-semibold">Luck</h3>
        <span className="text-xs text-text-muted font-normal">
          across {total.items} tracked drop{total.items === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-2xl font-semibold ${verdict.tone}`}>{verdict.label}</span>
        <span className="text-sm text-foreground">{formatNet(total.net)}</span>
        <span className="text-xs text-text-muted">
          {Math.round(total.obtained).toLocaleString()} drops where the rates owed{' '}
          {total.expected >= 10 ? Math.round(total.expected).toLocaleString() : total.expected.toFixed(1)}
        </span>
      </div>

      {/* Where they sit among every outcome that could have happened. The marker is the point of the
          bar, so it stays legible without a legend. */}
      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-brown-dark overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1/2 border-r border-card-border/60" />
          <div
            className={`absolute inset-y-0 w-1.5 rounded-full ${verdict.bar}`}
            style={{ left: `calc(${Math.min(99, Math.max(1, total.percentile))}% - 3px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted/70 mt-1">
          <span>driest</span>
          <span>
            luckier than {total.percentile.toFixed(0)}% of outcomes
            {odds && total.verdict !== 'on-rate' ? ` · ${odds} end up here` : ''}
          </span>
          <span>luckiest</span>
        </div>
      </div>

      {(dry.length > 0 || spooned.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3 mt-4 pt-3 border-t border-card-border">
          {dry.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Driest</div>
              <ul className="divide-y divide-card-border/60">
                {dry.map((i) => (
                  <ItemRow key={i.itemId} item={i} tone="dry" />
                ))}
              </ul>
            </div>
          )}
          {spooned.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Luckiest</div>
              <ul className="divide-y divide-card-border/60">
                {spooned.map((i) => (
                  <ItemRow key={i.itemId} item={i} tone="spoon" />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
