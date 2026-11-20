import { clansWithHealth } from '@/lib/clanHealthDb';
import { notFound } from 'next/navigation';

import { operatorEmail } from '@/lib/staffSight';
import { allClans } from '@/lib/platformView';
import { myLiveGrants } from '@/lib/actAs';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import { db } from '@/db';
import { clans as clansTable } from '@/db/schema';
import { foundViaLabel } from '@/lib/noticeRules';
import { count, desc, isNotNull } from 'drizzle-orm';
import { runningPlanTrials } from '@/lib/planTrials';
import { tierNameOf } from '@/lib/planTrialRules';
import { lastOwnerMessages } from '@/lib/staffMessage';
import ClansClient from './ClansClient';

export const dynamic = 'force-dynamic';

export default async function StaffClansPage() {
  // The layout gates this too; asked again here because this page decides what the operator may
  // DO, and that answer has to come from the same live read rather than from the shell's memory.
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const [{ clans, health }, grants, sources] = await Promise.all([
    // Every clan with how it is doing (lib/clanHealthDb): the list filters and sorts by it.
    clansWithHealth(),
    myLiveGrants(actor.user.userId),
    // "Where did you find Anvil?" answers, most common first (asked on /clans/new).
    // clan-scope: global -- a platform-wide tally.
    db
      .select({ via: clansTable.foundVia, n: count() })
      .from(clansTable)
      .where(isNotNull(clansTable.foundVia))
      .groupBy(clansTable.foundVia)
      .orderBy(desc(count())),
  ]);

  // A FREE TRIAL OF A HIGHER PLAN changes what the clan can do without changing the plan it is on
  // record as paying for, so the list said "Free" for a space running on Gold. Shown beside the plan.
  const running = await runningPlanTrials(clans.map((c) => c.id)).catch(() => new Map<number, { tier: string; endsAt: number }>());
  const trials: Record<number, { name: string; endsAt: number }> = {};
  for (const c of clans) {
    const t = running.get(c.id);
    if (t) trials[c.id] = { name: tierNameOf(c.kind, t.tier), endsAt: t.endsAt };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Clans</h1>
      <p className="mt-1 text-sm text-gray-400">
        Lifecycle and entitlement only. A clan&rsquo;s events, roster and settings are the clan&rsquo;s
        — reaching those needs a grant in that clan, which this page does not confer.
      </p>
      {sources.length > 0 && (
        <p className="mt-3 text-xs text-text-dim">
          Found Anvil via:{' '}
          {sources.map((s, i) => (
            <span key={s.via ?? i} className="text-gray-300">
              {i ? ' · ' : ''}
              {foundViaLabel(s.via) ?? s.via} {s.n}
            </span>
          ))}
        </p>
      )}
      <div className="mt-6">
        <ClansClient
          health={health}
          trials={trials}
          lastSent={await lastOwnerMessages(clans.map((c) => c.id))}
          // Owner and billing emails are whole for the top platform role only (lib/staffSight).
          clans={clans.map((c) => ({
            ...c,
            ownerEmail: operatorEmail(actor.role, c.ownerEmail),
            contactEmail: operatorEmail(actor.role, c.contactEmail),
          }))}
          canWrite={hasPlatformRole(actor.role, 'staff')} grants={grants} />
      </div>
    </div>
  );
}
