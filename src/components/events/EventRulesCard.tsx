import { en } from '@/lib/discordI18n';
import { renderMarkdown } from '@/lib/markdown';
import { mechanicsLines, trackingLines, type RulesFacts } from '@/lib/rulesMechanics';

/**
 * The board's rules on the event page — the same two halves `/bingo rules` posts: how THIS board
 * works (derived from its configuration, so it never drifts) and the host's rulebook. Collapsed by
 * default: everyone needs it once, nobody needs it above the board every visit.
 *
 * The mechanics lines are the Discord dictionary's English, which is Discord-flavoured markdown the
 * site renderer reads. No tile names anywhere, so it's safe on an unrevealed board.
 */
export default function EventRulesCard({ facts, defaultOpen = false }: { facts: RulesFacts; defaultOpen?: boolean }) {
  const mechanics = [
    ...mechanicsLines(en, facts.event, facts.rules, facts.pool, facts.fee, facts.missionCounts),
    ...trackingLines(en, null, facts.boardTiles),
  ].join('\n');
  const book = facts.rulebook;

  return (
    <details id="rules" open={defaultOpen} className="group mb-6 border border-card-border rounded-xl bg-card-bg scroll-mt-4">
      <summary className="flex items-center gap-2 cursor-pointer select-none px-4 py-3 list-none [&::-webkit-details-marker]:hidden">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <span className="font-semibold">Rules</span>
        <span className="text-xs text-text-muted">
          {book.source === 'none' ? 'how this board works' : 'how this board works · the rules'}
        </span>
        <span className="ml-auto text-text-muted text-sm transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">How this board works</h3>
          <div className="text-sm text-foreground">{renderMarkdown(mechanics)}</div>
        </div>
        {book.source !== 'none' && (
          <div>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
              {book.source === 'event' ? 'The rules' : `${book.hostClanName} house rules`}
            </h3>
            {book.text && <div className="text-sm text-foreground">{renderMarkdown(book.text)}</div>}
            {book.url && (
              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-gold hover:underline"
              >
                Full rules →
              </a>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
