import ClanLink from '@/components/ClanLink';
import { pathChip, type JoinPath } from '@/lib/characterState';

const TONE = {
  ok: 'border-card-border text-text-muted',
  check: 'border-card-border text-text-secondary',
  wait: 'border-amber-400/40 text-amber-300',
} as const;

/**
 * How a character came in, for staff: "plugin", "verified by XP check", "awaiting your staff: vouch"
 * (a link to Needs review, where the vouch is one click) or "vouched by staff". The same chip on the
 * sign-up rows, the roster and an event's team list (lib/characterState pathChip). It describes the
 * character's proof only, never the login behind it.
 */
export default function PathChip({
  path,
  waitingForHost = false,
  className = '',
}: {
  path: JoinPath | null | undefined;
  /** A sign-up row whose entry is still pending after staff vouched: say whose move it is. */
  waitingForHost?: boolean;
  className?: string;
}) {
  const chip = pathChip(path);
  if (!chip) return null;
  const cls = `inline-block whitespace-nowrap rounded border px-1 py-0.5 text-[10px] uppercase tracking-wide ${TONE[chip.tone]} ${className}`;
  const label = path === 'vouched' && waitingForHost ? 'vouched by staff, waiting for the host' : chip.label;
  if (path === 'manual') {
    return (
      <ClanLink href="/admin/people/needs-review" title={chip.title} className={cls}>
        {label}
      </ClanLink>
    );
  }
  return (
    <span title={chip.title} className={cls}>
      {label}
    </span>
  );
}
