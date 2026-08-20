import type { LifecycleStep } from '@/lib/eventStage';
import ClanLink from '@/components/ClanLink';

/**
 * The event's whole life in one strip: Built → Tiles → Drafted → Running → Results → Payouts.
 *
 * Exactly one step is lit (lib/eventStage decides which), and each step links to the surface that
 * moves it forward — so "what do I do next" is answerable without opening anything.
 */
export default function EventLifecycleBar({
  steps,
  hrefFor,
}: {
  steps: LifecycleStep[];
  /** Where each step goes when clicked, by step key. A weekly's steps differ from a board's. */
  hrefFor: Record<string, string>;
}) {
  return (
    <ol
      className={`grid grid-cols-3 ${
        steps.length > 4 ? 'sm:grid-cols-6' : 'sm:grid-cols-4'
      } rounded-xl border border-card-border bg-brown-dark/30 overflow-hidden mb-6`}
    >
      {steps.map((step) => (
        <li
          key={step.key}
          className={`relative border-b sm:border-b-0 sm:border-r last:border-r-0 border-card-border ${
            step.state === 'now'
              ? 'bg-gradient-to-b from-gold/15 to-gold/[0.04]'
              : step.state === 'done'
                ? 'bg-accent-green/[0.05]'
                : ''
          }`}
        >
          <ClanLink href={hrefFor[step.key] ?? '#'} className="block px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
            <div
              className={`text-[10px] uppercase tracking-wider truncate ${
                step.state === 'now'
                  ? 'text-gold'
                  : step.state === 'done'
                    ? 'text-accent-green-light/75'
                    : 'text-text-muted/70'
              }`}
            >
              {step.state === 'done' ? '✓ ' : ''}
              {step.detail}
            </div>
            <div
              className={`text-xs font-semibold mt-0.5 ${
                step.state === 'now'
                  ? 'text-gold-light'
                  : step.state === 'done'
                    ? 'text-accent-green-light'
                    : 'text-text-muted'
              }`}
            >
              {step.label}
            </div>
          </ClanLink>
          {step.state === 'now' && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-gold" />}
        </li>
      ))}
    </ol>
  );
}
