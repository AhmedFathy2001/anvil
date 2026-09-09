import { notFound } from 'next/navigation';

import { clanDetail, platformActions } from '@/lib/platformView';
import { billingStatus, liveness } from '@/lib/clanBilling';
import { requirePlatformPage } from '@/lib/platformAccess';
import { hasPlatformRole } from '@/lib/clanRoles';
import ClanLink from '@/components/ClanLink';

export const dynamic = 'force-dynamic';

/**
 * Everything about one clan, on one page.
 *
 * WHAT THIS REPLACES. Answering "what is going on with this clan" meant four surfaces: a row in the
 * directory for its plan and cap, the errors tab filtered by eye, the operator log filtered by eye,
 * and a guess at who its staff were — with the billing columns visible on none of them, because
 * nothing outside the customer's own /portal read them at all. None of those four agreed to be
 * about the same clan, so the operator did the joining in their head.
 *
 * NOTHING HERE IS EDITABLE, deliberately. The lifecycle controls live in the directory because that
 * is where clans are compared and a plan is decided between them; duplicating them here would mean
 * two places that set a plan and one of them would drift. This page is for reading, and every
 * control it points at is somewhere that already owned it.
 */
export default async function StaffClanPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePlatformPage('support');
  if (!actor) notFound();

  const { id } = await params;
  const detail = await clanDetail(parseInt(id, 10));
  if (!detail) notFound();

  const { clan, staff, recentEvents, openErrors } = detail;
  const now = Date.now();
  const billing = billingStatus(clan, now);
  const live = liveness(clan, now);
  // Bans, role grants, ownership, borrowed access — what platform authority has done TO this clan.
  // The query already took a clan filter; nothing had ever passed it one.
  const actions = await platformActions(20, { clanId: clan.id });
  const canWrite = hasPlatformRole(actor.role, 'staff');

  return (
    <div>
      <ClanLink href="/staff/clans" className="mb-4 inline-block text-sm text-text-muted hover:text-gold">
        &larr; All clans
      </ClanLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{clan.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            <a href={`https://${clan.host}`} target="_blank" rel="noreferrer" className="hover:text-gold">
              {clan.host}
            </a>
            {' · '}
            {clan.verified ? (
              <span className="text-emerald-400">✓ {clan.inGameName}</span>
            ) : (
              <span className="text-amber-400/80">
                unverified{clan.inGameName ? ` · claims “${clan.inGameName}”` : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Chip label={clan.status} tone={clan.status === 'active' ? 'ok' : clan.status === 'suspended' ? 'warn' : 'plain'} />
          <Chip label={clan.plan} tone="plain" />
          {canWrite && (
            <ClanLink
              href="/staff/clans"
              className="rounded-lg border border-card-border px-2.5 py-1 text-text-muted hover:border-gold/40 hover:text-gold"
            >
              Change plan or status →
            </ClanLink>
          )}
        </div>
      </div>

      {/* MONEY FIRST. It is the fact this page was built to surface, and the one the directory
          could not show at all. */}
      <Section title="Subscription">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="State"
            value={billing.label}
            tone={billing.attention ? (billing.state === 'lapsed' ? 'bad' : 'warn') : 'plain'}
          />
          <Fact label="Contact" value={clan.contactEmail ?? '—'} />
          <Fact label="Trial ends" value={stamp(clan.trialEndsAt)} />
          <Fact
            label={clan.cancelAtPeriodEnd ? 'Access ends' : 'Renews'}
            value={stamp(clan.currentPeriodEnd)}
          />
        </div>
        {billing.state === 'comped' && (
          <p className="mt-2 text-xs text-text-muted">
            On a paid plan with no Gumroad subscription behind it — comped or migrated by hand. Never
            chase this one for payment.
          </p>
        )}
      </Section>

      <Section title="Size and activity">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Members"
            value={String(clan.members)}
            tone={clan.memberCap != null && clan.members > clan.memberCap ? 'warn' : 'plain'}
            hint={clan.memberCap != null ? `cap ${clan.memberCap}` : 'no cap'}
          />
          <Fact label="Guests" value={String(clan.guests)} />
          <Fact
            label="Last roster sync"
            value={live.syncDays == null ? 'never' : live.syncDays === 0 ? 'today' : `${live.syncDays}d ago`}
            tone={live.quiet ? 'warn' : 'plain'}
            hint={live.quiet ? 'nobody is running the plugin' : undefined}
          />
          <Fact
            label="Last event started"
            value={live.eventDays == null ? 'never' : live.eventDays === 0 ? 'today' : `${live.eventDays}d ago`}
          />
        </div>
      </Section>

      <Section title="Who runs it">
        {staff.length === 0 ? (
          <Empty>
            Nobody holds authority here. Its own transfer flow needs a current owner, so it cannot fix
            this itself — appoint one from the directory.
          </Empty>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {staff.map((s) => (
              <li key={s.userId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{s.name ?? `#${s.userId}`}</span>
                <span className="text-xs text-text-muted">
                  {s.role}
                  {s.canEditTiles && ' · builds boards'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent events">
        {recentEvents.length === 0 ? (
          <Empty>This clan has never run a board or a competition.</Empty>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {recentEvents.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate">{e.name}</span>
                <span className="shrink-0 text-xs text-text-muted tabular-nums">
                  {e.kind === 'weekly' ? 'competition · ' : ''}
                  {stamp(e.startDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {openErrors.length > 0 && (
        <Section title="Unresolved errors">
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-accent-red/30 bg-card-bg">
            {openErrors.map((e) => (
              <li key={e.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{e.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    ×{e.count} · {stamp(e.lastSeenAt)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-text-muted">
                  {e.path ? `${e.path} — ` : ''}
                  {e.message}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-muted">
            <ClanLink href="/staff/errors" className="text-gold hover:underline">
              Every clan’s errors →
            </ClanLink>
          </p>
        </Section>
      )}

      <Section title="What operators did here">
        {actions.length === 0 ? (
          <Empty>Nothing has been done to this clan with platform authority.</Empty>
        ) : (
          <ul className="divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
            {actions.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-text-muted">{a.eventType.replace(/^platform_/, '').replace(/_/g, ' ')}</span>
                  {a.notes && <span className="ml-2 text-xs text-text-muted/80">{a.notes}</span>}
                </span>
                <span className="shrink-0 text-xs text-text-muted tabular-nums">
                  {a.hadActor ? (a.actor ?? 'a deleted login') : 'automatic'} · {stamp(a.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Small pieces. Kept local — this is the only page shaped like this.
   --------------------------------------------------------------------------- */

/** Date only. These columns hold two timestamp shapes and only the first ten characters agree. */
function stamp(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

const TONE: Record<string, string> = {
  plain: 'text-foreground',
  ok: 'text-emerald-400',
  warn: 'text-yellow-400',
  bad: 'text-accent-red',
};

function Fact({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted/70">{label}</div>
      <div className={`mt-1 truncate text-sm font-medium ${TONE[tone]}`} title={value}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[10px] text-text-muted/70">{hint}</div>}
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: keyof typeof TONE }) {
  return (
    <span className={`rounded-full border border-card-border px-2.5 py-1 ${TONE[tone]}`}>{label}</span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-5 w-1 bg-gold" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-card-border bg-card-bg p-4 text-sm text-text-muted">{children}</p>
  );
}
