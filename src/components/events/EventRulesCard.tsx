import { en } from '@/lib/discordI18n';
import { renderMarkdown } from '@/lib/markdown';
import { mechanicsLines, trackingLines, type RulesFacts } from '@/lib/rulesMechanics';

/**
 * The board's rules on the event page — the same two halves `/bingo rules` posts: how THIS board
 * works (derived from its configuration, so it never drifts) and the host's rulebook. Shown in the
 * Rules tab of EventTabs: everyone needs it once, nobody needs it above the board every visit.
 *
 * The mechanics lines are the Discord dictionary's English, which is Discord-flavoured markdown the
 * site renderer reads. No tile names anywhere, so it's safe on an unrevealed board.
 */
export default function EventRulesCard({ facts }: { facts: RulesFacts }) {
  const mechanics = [
    ...mechanicsLines(en, facts.event, facts.rules, facts.pool, facts.fee, facts.missionCounts, facts.guestFee ?? null),
    ...trackingLines(en, null, facts.boardTiles),
  ].join('\n');
  const book = facts.rulebook;

  return (
    <div className="grid gap-4 md:grid-cols-2">
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
  );
}
