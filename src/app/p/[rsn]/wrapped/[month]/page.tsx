import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import CopyLink from '@/app/events/[eventId]/wrapped/CopyLink';
import { CardImage } from '@/app/events/[eventId]/wrapped/parts';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyUser } from '@/lib/auth';
import { isApexHost } from '@/lib/clanContext';
import { formatHours, ordinal, shortNumber } from '@/lib/eventWrappedRules';
import { getMonthlyWrapped, monthsWithData } from '@/lib/monthlyWrapped';
import {
  isMonthKey,
  isYearKey,
  monthHasAnything,
  monthLabel,
  monthlyCardStats,
  wrappedIsOpen,
  wrappedOpensAt,
  type MonthItem,
} from '@/lib/monthlyWrappedRules';
import { getYearlyWrapped } from '@/lib/yearlyWrapped';
import type { YearlyWrapped } from '@/lib/yearlyWrappedRules';
import { configuredOrigin } from '@/lib/request-origin';
import { itemIconUrl } from '@/lib/tileIcons';

export const dynamic = 'force-dynamic';

type Params = { rsn: string; month: string };

async function load(p: Params) {
  if (!isApexHost((await headers()).get('host'))) return null;
  const key = p.month;
  if (!isMonthKey(key) && !isYearKey(key)) return null;
  const session = await verifyUser();
  const character = await apexCharacter(decodeURIComponent(p.rsn), session?.playerId ?? null);
  if (!character) return null;
  const open = wrappedIsOpen(key);
  // A year is previewable by its owner before it opens; a running month isn't worth previewing.
  const preview = !open && isYearKey(key) && character.viewerOwns;
  const months = await monthsWithData(character.accountId);
  if (!open && !preview) return { character, w: null, year: null, months, key, preview };
  const year: YearlyWrapped | null = isYearKey(key) ? await getYearlyWrapped(character.accountId, character.rsn, key) : null;
  const w = year ?? (await getMonthlyWrapped(character.accountId, character.rsn, key));
  return { character, w, year, months, key, preview };
}

const opensOn = (key: string) =>
  wrappedOpensAt(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const data = await load(await params);
  if (!data?.w || data.preview) return {};
  const { character, w } = data;
  const path = `/p/${encodeURIComponent(character.rsn)}/wrapped/${w.monthKey}`;
  const facts = monthlyCardStats(w).map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ');
  const title = `${character.rsn} — ${w.monthLabel} Wrapped on Anvil`;
  const description = facts || `${character.rsn}'s ${w.monthLabel} in Old School RuneScape.`;
  const image = `/api/og/monthly/${encodeURIComponent(character.rsn)}/${w.monthKey}`;
  return {
    title,
    description,
    alternates: { canonical: `${configuredOrigin()}${path}` },
    ...(character.privateToViewer ? { robots: { index: false, follow: false } } : {}),
    openGraph: { type: 'profile', title, description, url: `${configuredOrigin()}${path}`, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg px-4 py-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-2xl font-bold text-gold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-semibold mb-3">
        <span className="w-1 h-5 bg-gold" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-card-border bg-card-bg divide-y divide-card-border">{children}</div>;
}

function Row({ left, right, icon }: { left: ReactNode; right: ReactNode; icon?: number | null }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      {icon != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={itemIconUrl(icon)} alt="" className="h-6 w-6 object-contain shrink-0" />
      )}
      <span className="truncate">{left}</span>
      <span className="ml-auto shrink-0 text-text-muted tabular-nums">{right}</span>
    </div>
  );
}

const SLOT_LIMIT = 15;

function itemRight(i: MonthItem): string {
  if (i.denominator != null) return `1 in ${i.denominator.toLocaleString('en-US')}${i.source ? ` · ${i.source}` : ''}`;
  return i.source ?? '';
}

/**
 * A character's month: what they trained, killed, logged and set, on one card they can paste.
 *
 * Same gate as the character page (shared, or the viewer's own). Everything comes off the account,
 * so it works the same for a player in no clan.
 */
export default async function MonthlyWrappedPage({ params }: { params: Promise<Params> }) {
  const data = await load(await params);
  if (!data) notFound();
  const { character, w, year, months, key, preview } = data;
  const base = `/p/${encodeURIComponent(character.rsn)}`;
  const isYear = isYearKey(key);
  const idx = months.indexOf(key);
  const older = isYear ? null : idx >= 0 ? months[idx + 1] : months.find((m) => m < key);
  const newer = isYear ? null : idx > 0 ? months[idx - 1] : [...months].reverse().find((m) => m > key);
  const yearMonths = isYear ? months.filter((m) => m.startsWith(`${key}-`)) : [];

  const header = (
    <div>
      <ClanLink href={base} className="text-sm text-text-muted hover:text-gold transition-colors">← {character.rsn}</ClanLink>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
        <h1 className="text-2xl font-bold text-gold">
          {monthLabel(key)} Wrapped
          {year?.trackedSince && (
            <span className="text-text-muted font-normal text-lg">
              {' '}since {new Date(`${year.trackedSince}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
            </span>
          )}
        </h1>
        <nav className="flex items-center gap-3 text-sm">
          {older ? <ClanLink href={`${base}/wrapped/${older}`} className="text-text-muted hover:text-gold">← {monthLabel(older)}</ClanLink> : null}
          {newer ? <ClanLink href={`${base}/wrapped/${newer}`} className="text-text-muted hover:text-gold">{monthLabel(newer)} →</ClanLink> : null}
          {!isYear && <ClanLink href={`${base}/wrapped/${key.slice(0, 4)}`} className="text-text-muted hover:text-gold">{key.slice(0, 4)} →</ClanLink>}
        </nav>
      </div>
      {preview && (
        <p className="text-xs text-gold mt-2">
          Preview, only you can see it. Your {key} Wrapped comes out on {opensOn(key)}, and the numbers keep growing until then.
        </p>
      )}
    </div>
  );

  if (!w) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        {header}
        <div className="max-w-xl mx-auto border border-dashed border-card-border rounded-xl p-8 text-center">
          <p className="text-lg font-semibold mb-1">Not out yet</p>
          <p className="text-sm text-text-muted">
            {monthLabel(key)} Wrapped comes out on {opensOn(key)}. Keep playing with the Anvil plugin running and it all counts.
          </p>
        </div>
      </div>
    );
  }

  const any = monthHasAnything(w);
  const efficient = Math.round((w.ehpGained + w.ehbGained) * 60);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {header}

      {!any ? (
        <div className="max-w-xl mx-auto border border-dashed border-card-border rounded-xl p-8 text-center">
          <p className="text-lg font-semibold mb-1">Nothing tracked in {monthLabel(key)}</p>
          <p className="text-sm text-text-muted">No XP, kills, log slots or PBs reached us. With the Anvil plugin running, every session counts.</p>
        </div>
      ) : (
        <>
          <div className="max-w-3xl space-y-3">
            {!character.privateToViewer && !preview && (
              <CardImage src={`/api/og/monthly/${encodeURIComponent(character.rsn)}/${key}`} alt={`${character.rsn}'s ${monthLabel(key)} Wrapped`} />
            )}
            {!preview && (
              <div className="flex flex-wrap items-center gap-3">
                <CopyLink label={character.viewerOwns ? 'Copy link to your Wrapped' : 'Copy link'} />
                <span className="text-xs text-text-muted">
                  {character.privateToViewer ? (
                    <>
                      This character isn&rsquo;t shared, so only you can open the link.{' '}
                      <ClanLink href="/profile" className="text-gold hover:underline">Share it from your profile</ClanLink>.
                    </>
                  ) : (
                    'Paste it in Discord and it shows as this card.'
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {w.xpGained > 0 && <Stat label="XP gained" value={shortNumber(w.xpGained)} />}
            {w.kcGained > 0 && <Stat label="Boss kills" value={w.kcGained.toLocaleString('en-US')} />}
            {w.newSlots > 0 && <Stat label="New log slots" value={w.newSlots.toLocaleString('en-US')} />}
            {w.daysActive > 0 && <Stat label="Days active" value={w.daysActive.toLocaleString('en-US')} />}
            {efficient > 0 && <Stat label="Efficient time" value={formatHours(efficient)} />}
            {w.pbs.length > 0 && <Stat label="Personal bests" value={w.pbs.length.toLocaleString('en-US')} />}
            {w.pets.length > 0 && <Stat label={w.pets.length === 1 ? 'Pet' : 'Pets'} value={w.pets.length.toLocaleString('en-US')} />}
            {year && year.events.length > 0 && <Stat label="Events played" value={year.events.length.toLocaleString('en-US')} />}
            {year?.busiestMonth && <Stat label="Busiest month" value={monthLabel(year.busiestMonth.key).split(' ')[0]} />}
          </div>

          {(w.maxed.length > 0 || w.milestones.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {w.maxed.map((s) => (
                <span key={s} className="rounded-full border border-gold/60 bg-gold/10 px-3 py-1 text-sm text-gold">99 {s}</span>
              ))}
              {w.milestones.map((m) => (
                <span key={m} className="rounded-full border border-card-border px-3 py-1 text-sm text-text-muted">{m}</span>
              ))}
            </div>
          )}

          {year && year.events.length > 0 && (
            <Section title="Events">
              <Rows>
                {year.events.map((e) => (
                  <div key={e.eventId} className="px-4 py-3 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      {e.cardKey != null ? (
                        <ClanLink href={`/c/${e.clanSlug}/events/${e.eventId}/wrapped/p/${e.cardKey}`} className="font-medium hover:text-gold">
                          {e.name}
                        </ClanLink>
                      ) : (
                        <span className="font-medium">{e.name}</span>
                      )}
                      <span className="text-sm text-text-muted">
                        {[
                          e.team ? `${ordinal(e.team.rank)} of ${e.team.of} · ${e.team.name}` : null,
                          e.placeInTeam ? `${ordinal(e.placeInTeam.rank)} on the team` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {e.awards.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {e.awards.map((a) => (
                          <span key={a} className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs text-gold">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Rows>
            </Section>
          )}

          <div className="grid gap-8 lg:grid-cols-2 items-start">
            <div className="space-y-8">
              {w.topBosses.length > 0 && (
                <Section title="Bosses">
                  <Rows>
                    {w.topBosses.map((b) => (
                      <Row key={b.key} left={b.name} right={`${b.kc.toLocaleString('en-US')} KC`} />
                    ))}
                  </Rows>
                </Section>
              )}
              {w.topSkills.length > 0 && (
                <Section title="Skills">
                  <Rows>
                    {w.topSkills.map((s) => (
                      <Row key={s.key} left={s.name} right={`${shortNumber(s.xp)} XP`} />
                    ))}
                  </Rows>
                </Section>
              )}
              {w.pbs.length > 0 && (
                <Section title="Personal bests">
                  <Rows>
                    {w.pbs.map((p, i) => (
                      <Row key={`${p.activity}-${p.teamSize}-${i}`} left={p.teamSize > 1 ? `${p.activity} (${p.teamSize})` : p.activity} right={p.time} />
                    ))}
                  </Rows>
                </Section>
              )}
              {yearMonths.length > 0 && (
                <Section title="Month by month">
                  <div className="flex flex-wrap gap-2">
                    {yearMonths.map((m) => (
                      <ClanLink key={m} href={`${base}/wrapped/${m}`} className="rounded-lg border border-card-border bg-card-bg px-3 py-1.5 text-sm hover:border-gold/60">
                        {monthLabel(m).split(' ')[0]}
                      </ClanLink>
                    ))}
                  </div>
                </Section>
              )}
            </div>
            <div className="space-y-8">
              {(w.pets.length > 0 || w.biggestDrop) && (
                <Section title="Drops">
                  <Rows>
                    {w.pets.map((p) => (
                      <Row key={p.itemName} icon={p.itemId} left={p.itemName} right="Pet" />
                    ))}
                    {w.biggestDrop && (
                      <Row
                        icon={w.biggestDrop.itemId}
                        left={w.biggestDrop.itemName}
                        right={w.biggestDrop.valueGp ? `Biggest drop · ${shortNumber(w.biggestDrop.valueGp)} gp` : 'Biggest drop'}
                      />
                    )}
                  </Rows>
                </Section>
              )}
              {w.slots.length > 0 && (
                <Section title={`New log slots (${w.newSlots})`}>
                  <Rows>
                    {w.slots.slice(0, SLOT_LIMIT).map((s) => (
                      <Row key={s.itemName} icon={s.itemId} left={s.itemName} right={itemRight(s)} />
                    ))}
                    {w.slots.length > SLOT_LIMIT && (
                      <details>
                        <summary className="cursor-pointer px-4 py-2.5 text-sm text-text-muted hover:text-gold">Show {w.slots.length - SLOT_LIMIT} more</summary>
                        <div className="divide-y divide-card-border border-t border-card-border">
                          {w.slots.slice(SLOT_LIMIT).map((s) => (
                            <Row key={s.itemName} icon={s.itemId} left={s.itemName} right={itemRight(s)} />
                          ))}
                        </div>
                      </details>
                    )}
                  </Rows>
                </Section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
