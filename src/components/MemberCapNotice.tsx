import Link from 'next/link';
import type { CapStatus } from '@/lib/member-cap';

/**
 * Plan-limit banner for the clan's own admins.
 *
 * Silent while there's nothing to do — an "everything is fine" banner is just noise that teaches
 * people to ignore the space where the real warning will appear. It speaks up while there's still
 * room to act (approaching), counts down once over (grace), and states plainly what stopped and how
 * to undo it (blocked). It never implies the site is broken, because it isn't: existing members keep
 * playing throughout, and only new joins are affected, and only after the grace window.
 */
export default function MemberCapNotice({ status }: { status: CapStatus }) {
  if (status.cap == null || status.state === 'ok') return null;

  const tone =
    status.state === 'blocked'
      ? { border: 'border-accent-red/50', bg: 'bg-accent-red/10', text: 'text-accent-red', icon: '⛔' }
      : status.state === 'grace'
        ? { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: '⚠️' }
        : { border: 'border-gold/40', bg: 'bg-gold/5', text: 'text-gold', icon: 'ℹ️' };

  const headline =
    status.state === 'blocked'
      ? 'New members are not being added'
      : status.state === 'grace'
        ? `Over your plan — ${status.graceDaysLeft} day${status.graceDaysLeft === 1 ? '' : 's'} to sort it`
        : `${status.remaining} member slot${status.remaining === 1 ? '' : 's'} left`;

  return (
    <div className={`mb-6 rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-none pt-0.5">{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className={`text-sm font-semibold ${tone.text}`}>{headline}</h2>
          <p className="text-sm text-foreground/80 mt-1">
            Your roster has <strong>{status.active.toLocaleString()}</strong> of{' '}
            <strong>{status.cap.toLocaleString()}</strong> member slots used.{' '}
            {status.state === 'blocked' ? (
              <>
                Members already on the roster are unaffected and keep playing normally — only new
                joins stop. Upgrade your plan or remove inactive members to resume.
              </>
            ) : status.state === 'grace' ? (
              <>
                Everything keeps working for now. If you&apos;re still over after the grace period,
                new members stop being added — existing ones are never affected.
              </>
            ) : (
              <>Guests don&apos;t count toward this.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/clan?tab=roster"
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border hover:border-gold/40 transition-colors"
            >
              Review roster
            </Link>
            {status.state !== 'approaching' && (
              <a
                href="https://anvilosrs.com/#pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gold text-brown-dark hover:bg-yellow-500 transition-colors"
              >
                Upgrade plan
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
