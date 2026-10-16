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
import { formatHours, shortNumber } from '@/lib/eventWrappedRules';
import { getMonthlyWrapped, monthsWithData } from '@/lib/monthlyWrapped';
import {
  isMonthKey,
  monthHasAnything,
  monthKeyOf,
  monthLabel,
  monthlyCardStats,
  type MonthItem,
} from '@/lib/monthlyWrappedRules';
import { configuredOrigin } from '@/lib/request-origin';
import { itemIconUrl } from '@/lib/tileIcons';

export const dynamic = 'force-dynamic';

type Params = { rsn: string; month: string };

async function load(p: Params) {
  if (!isApexHost((await headers()).get('host'))) return null;
  if (!isMonthKey(p.month) || p.month > monthKeyOf(new Date())) return null;
  const session = await verifyUser();
  const character = await apexCharacter(decodeURIComponent(p.rsn), session?.playerId ?? null);
  if (!character) return null;
  const [w, months] = await Promise.all([
    getMonthlyWrapped(character.accountId, character.rsn, p.month),
    monthsWithData(character.accountId),
  ]);
  return { character, w, months };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const data = await load(await params);
  if (!data) return {};
  const { character, w } = data;
  const path = `/p/${encodeURIComponent(character.rsn)}/wrapped/${w.monthKey}`;
  const facts = monthlyCardStats(w).map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ');
  const title = `${character.rsn} — ${w.monthLabel}${w.inProgress ? ' so far' : ''} on Anvil`;
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
  const { character, w, months } = data;
  const base = `/p/${encodeURIComponent(character.rsn)}`;
  const idx = months.indexOf(w.monthKey);
  const older = idx >= 0 ? months[idx + 1] : months.find((m) => m < w.monthKey);
  const newer = idx > 0 ? months[idx - 1] : [...months].reverse().find((m) => m > w.monthKey);
  const any = monthHasAnything(w);
  const efficient = Math.round((w.ehpGained + w.ehbGained) * 60);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <ClanLink href={base} className="text-sm text-text-muted hover:text-gold transition-colors">← {character.rsn}</ClanLink>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-1">
          <h1 className="text-2xl font-bold text-gold">
            {w.monthLabel}
            {w.inProgress && <span className="text-text-muted font-normal text-lg"> so far</span>}
          </h1>
          <nav className="flex items-center gap-3 text-sm">
            {older ? (
              <ClanLink href={`${base}/wrapped/${older}`} className="text-text-muted hover:text-gold">← {monthLabel(older)}</ClanLink>
            ) : null}
            {newer ? (
              <ClanLink href={`${base}/wrapped/${newer}`} className="text-text-muted hover:text-gold">{monthLabel(newer)} →</ClanLink>
            ) : null}
          </nav>
        </div>
        <p className="text-sm text-text-muted mt-1">
          {character.rsn}&rsquo;s month on one card. Copy the link and paste it in Discord: it shows as the card.
        </p>
      </div>

      {!any ? (
        <div className="max-w-xl mx-auto border border-dashed border-card-border rounded-xl p-8 text-center">
          <p className="text-lg font-semibold mb-1">Nothing tracked {w.inProgress ? 'yet this month' : 'this month'}</p>
          <p className="text-sm text-text-muted">
            No XP, kills, log slots or PBs reached us for {w.monthLabel}. With the Anvil plugin running, every session counts.
          </p>
        </div>
      ) : (
        <>
          <div className="max-w-3xl space-y-3">
            {!character.privateToViewer && <CardImage src={`/api/og/monthly/${encodeURIComponent(character.rsn)}/${w.monthKey}`} alt={`${character.rsn}'s ${w.monthLabel}`} />}
            <div className="flex flex-wrap items-center gap-3">
              <CopyLink label={character.viewerOwns ? 'Copy link to your month' : 'Copy link'} />
              {character.privateToViewer && (
                <span className="text-xs text-text-muted">
                  This character isn&rsquo;t shared, so only you can open the link.{' '}
                  <ClanLink href="/profile" className="text-gold hover:underline">Share it from your locker</ClanLink>.
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {w.xpGained > 0 && <Stat label="XP gained" value={shortNumber(w.xpGained)} />}
            {w.kcGained > 0 && <Stat label="Boss kills" value={w.kcGained.toLocaleString('en-US')} />}
            {w.newSlots > 0 && <Stat label="New log slots" value={`+${w.newSlots.toLocaleString('en-US')}`} />}
            {w.daysActive > 0 && <Stat label="Days active" value={w.daysActive.toLocaleString('en-US')} />}
            {efficient > 0 && <Stat label="Efficient time" value={formatHours(efficient)} />}
            {w.pbs.length > 0 && <Stat label="Personal bests" value={w.pbs.length.toLocaleString('en-US')} />}
            {w.pets.length > 0 && <Stat label={w.pets.length === 1 ? 'Pet' : 'Pets'} value={w.pets.length.toLocaleString('en-US')} />}
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
