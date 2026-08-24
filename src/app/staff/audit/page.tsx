import { platformActions, type PlatformAction } from '@/lib/platformView';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * What operators have done, with platform authority.
 *
 * THE TRAIL ALREADY EXISTED AND NOTHING READ IT. Bans, role grants, owner appointments and borrowed
 * grants have been writing to the audit log since each was built — and no page anywhere showed them.
 * A log nobody can read is a log that does not exist: the whole point of recording who suspended a
 * clan is that somebody can later ask.
 *
 * These entries appear on NO clan's own history page, by design — a platform action belongs to no
 * clan, so `/admin/clan/audit` filters them out. This is the only place they can be seen.
 *
 * Read-only, including for root. An audit log with an edit button is not one.
 */

/** What each event actually was, in words. Unknown types fall back to their raw name. */
const WHAT: Record<string, string> = {
  platform_banned: 'Banned from the platform',
  platform_unbanned: 'Platform ban lifted',
  platform_role_changed: 'Platform role changed',
  platform_owner_appointed: 'Clan owner appointed',
  platform_clan_updated: 'Clan updated',
  platform_act_as_granted: 'Borrowed a grant in this clan',
  platform_act_as_revoked: 'Handed back a borrowed grant',
};

/** The two that change who can sign in. Worth spotting in a long list. */
const SEVERE = new Set(['platform_banned', 'platform_role_changed']);

export default async function StaffAuditPage() {
  const actions = await platformActions(200);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Operator log</h1>
      <p className="mt-1.5 max-w-[70ch] text-sm text-gray-400">
        Every action taken with platform authority, newest first. Platform actions belong to no clan,
        so they appear on no clan&rsquo;s own history — this is the only place they are visible.
      </p>

      {actions.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-gray-400">
          Nothing yet. Bans, role changes, owner appointments and borrowed grants land here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
          {actions.map((a) => (
            <Row key={a.id} action={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ action }: { action: PlatformAction }) {
  const what = WHAT[action.eventType] ?? action.eventType;
  const detail = describe(action);

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-gray-500">
        {action.at.replace('T', ' ').slice(0, 16)}
      </span>

      <span className={`text-[14px] ${SEVERE.has(action.eventType) ? 'text-accent-red' : ''}`}>
        {what}
      </span>

      {action.clan && (
        <ClanLink href={`/c/${action.clan.slug}`} className="text-[13.5px] text-gold hover:underline">
          {action.clan.name}
        </ClanLink>
      )}

      {detail && <span className="text-[13px] text-gray-400">{detail}</span>}

      <span className="ml-auto shrink-0 text-[12.5px] text-gray-500">
        {action.actor ?? 'a deleted login'}
      </span>
    </li>
  );
}

/**
 * The one line worth reading out of the before/after JSON.
 *
 * Deliberately narrow. Dumping the payload would make the page unreadable, and the fields that
 * matter differ per event — a role change is a transition, a ban is a reason.
 */
function describe(a: PlatformAction): string | null {
  const after = parse(a.after);
  const before = parse(a.before);

  switch (a.eventType) {
    case 'platform_role_changed':
      return `${String(before?.platformRole ?? 'none')} → ${String(after?.platformRole ?? '?')}`;
    case 'platform_banned':
    case 'platform_unbanned':
      return after?.reason ? `“${String(after.reason)}”` : null;
    case 'platform_owner_appointed':
      return after?.to ? `to ${String(after.to)}` : null;
    default:
      return a.notes;
  }
}

function parse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
