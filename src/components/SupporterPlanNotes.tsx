import EarlyBirdBadge from '@/components/EarlyBirdBadge';
import TrialCard from '@/components/TrialCard';
import { SUPPORTER_CHECKOUT } from '@/lib/buyOffer';
import { manageUrl } from '@/lib/gumroadLinks';
import { TWO_MEMBERSHIPS_NOTICE } from '@/lib/supporterDuplicates';
import type { SupporterPlanNotes as Notes } from '@/lib/supporterPlanNotes';
import { usd } from '@/lib/billingInterval';

const dayOf = (iso: string | null) => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/**
 * On a person's own plan page (Settings → Account, /supporter): their trial from Anvil, gifts from
 * Anvil, a membership waiting for its first payment, and the "two memberships" notice.
 */
export default function SupporterPlanNotes({ notes }: { notes: Notes }) {
  const { trial, buttons } = notes;
  if (!trial && notes.giftLines.length === 0 && !notes.held && notes.toCancel.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {notes.toCancel.map((m) => (
        <div key={m.rowId} role="status" className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-[13.5px] leading-relaxed text-orange-200">
          {TWO_MEMBERSHIPS_NOTICE}:{' '}
          <a href={manageUrl(m.subscriptionId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            manage your older {m.tierName} membership on Gumroad
          </a>
          . Gumroad emails a sign-in link to the address you paid with. This notice goes away once Gumroad tells us it is cancelled.
        </div>
      ))}
      {notes.held && (
        <div role="status" className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] leading-relaxed text-gold-light">
          You&rsquo;ve already had your free trial, so {notes.held.tierName} starts when your first payment goes through
          {dayOf(notes.held.startsAt) ? ` on ${dayOf(notes.held.startsAt)}` : ''}. Gumroad opened this membership with a free
          period; nothing is charged until then.
          {notes.held.subscriptionId && (
            <>
              {' '}
              <a href={manageUrl(notes.held.subscriptionId)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                Manage it on Gumroad
              </a>
              .
            </>
          )}
        </div>
      )}
      {trial && (
        <TrialCard
          tierName={trial.tierName}
          who="you"
          endsAt={trial.endsAt}
          phase={trial.phase}
          daysLeft={trial.daysLeft}
          keeps="your account, your stats and everything you made. Any colours you picked are remembered."
          loses={`your ${trial.tierName} flair and perks stop, and you are back on what you pay for (or no tier).`}
          href={buttons.kind === 'subscribe' ? `${SUPPORTER_CHECKOUT}${buttons.url.includes('pay=now') ? '?pay=now' : ''}` : null}
          soon={buttons.kind === 'soon'}
          chargeToday={usd(trial.monthlyUsd)}
          every="month"
          remindUrl="/api/supporter/trial-remind"
          remindRequested={trial.remindRequested}
        >
          <EarlyBirdBadge />
        </TrialCard>
      )}
      {notes.giftLines.map((line) => (
        <p key={line} className="rounded-xl border border-gold/30 bg-gold/[0.05] px-4 py-3 text-[13.5px] text-foreground/90">
          {line}
        </p>
      ))}
    </div>
  );
}
