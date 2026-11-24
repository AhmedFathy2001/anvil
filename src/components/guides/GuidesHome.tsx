'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import { GUIDE_ACCOUNTS, GUIDE_BUILDS, setupFit, type GuideAccount, type GuideBuild } from '@/lib/guideSetups';
import type { GearSetup, TierKey } from '@/lib/guideTiers';
import { ItemSprite } from './osrs';

export interface HomeCard {
  id: number;
  slug: string;
  title: string;
  summary: string;
  category: string;
  kind: string;
  icon: number | null;
  setups: Pick<GearSetup, 'tier' | 'accounts' | 'builds' | 'req' | 'name' | 'stats'>[];
  community: number;
  by: string;
  origin: 'clan' | 'library';
}
export interface HomeCategory {
  key: string;
  label: string;
  icon: string;
}
export interface HomePick {
  slug: string;
  title: string;
  icon: number | null;
  level: string;
  why: string;
  stat: string;
}

const chip = (on: boolean) =>
  `h-9 rounded-full border px-3.5 text-[13px] transition-colors ${on ? 'border-gold bg-gold font-semibold text-brown-dark' : 'border-card-border bg-card-bg text-foreground hover:border-gold/50'}`;
const PREF = 'anvil.guides.filters';

export default function GuidesHome({
  title,
  intro,
  cards,
  categories,
  picks,
  pickedFrom,
  level,
  account: initialAccount,
  build: initialBuild,
  canManage,
}: {
  title: string;
  intro: string;
  cards: HomeCard[];
  categories: HomeCategory[];
  picks: HomePick[];
  pickedFrom: string | null;
  level: TierKey | null;
  account: GuideAccount | null;
  build: GuideBuild | null;
  canManage: boolean;
}) {
  const [q, setQ] = useState('');
  const [account, setAccount] = useState<GuideAccount | null>(initialAccount);
  const [build, setBuild] = useState<GuideBuild>(initialBuild ?? 'any');
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(PREF) ?? 'null') as { account?: GuideAccount; build?: GuideBuild } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (j?.account && !initialAccount) setAccount(j.account);
      if (j?.build && !initialBuild) setBuild(j.build);
    } catch {
      /* storage unavailable */
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        box.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [initialAccount, initialBuild]);
  const remember = (a: GuideAccount | null, b: GuideBuild) => {
    try {
      localStorage.setItem(PREF, JSON.stringify({ account: a, build: b }));
    } catch {
      /* storage unavailable */
    }
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((c) => {
      if (needle && !`${c.title} ${c.summary} ${c.category}`.toLowerCase().includes(needle)) return false;
      if (!c.setups.length) return true;
      return c.setups.some((s) => setupFit(s as GearSetup, { account, build }).ok);
    });
  }, [cards, q, account, build]);
  const totalSetups = cards.reduce((a, c) => a + c.setups.length, 0);
  const totalCommunity = cards.reduce((a, c) => a + c.community, 0);
  const groups = categories.map((cat) => ({ cat, items: shown.filter((c) => c.category === cat.key) })).filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">{title}</h1>
            <p className="mt-1 text-[15px] text-text-muted">{intro}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {canManage && (
              <ClanLink href="/admin/guides" className="rounded-lg border border-card-border px-3 py-1.5 text-text-muted hover:text-gold">
                Manage guides
              </ClanLink>
            )}
            <ClanLink href="/guides/wanted" className="rounded-lg border border-card-border px-3 py-1.5 text-text-muted hover:text-gold">
              Wanted
            </ClanLink>
            <ClanLink href="/guides/writers" className="rounded-lg border border-card-border px-3 py-1.5 text-text-muted hover:text-gold">
              Writers
            </ClanLink>
            <ClanLink href="/guides/propose" className="rounded-lg border border-gold/40 px-3 py-1.5 text-gold hover:bg-gold/10">
              Write a guide
            </ClanLink>
          </div>
        </div>
        <div className="flex h-14 items-center gap-3 rounded-xl border border-[#6b5326] bg-card-bg px-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <Input ref={box} aria-label="Search guides" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bosses, raids, skills…" className="h-full flex-1 border-0 bg-transparent px-0 text-base focus:border-0" />
          <span className="rounded border border-card-border px-2 py-0.5 text-xs text-text-muted">/</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {level && (
            <span className="flex h-9 items-center gap-2 rounded-full border border-[#6b5326] bg-[#2a2114] px-3.5 text-[13px]">
              Your level: <strong className="text-gold">{level[0].toUpperCase() + level.slice(1)}</strong>
              <span className="text-text-muted">(from hiscores)</span>
            </span>
          )}
          <span className="h-6 w-px bg-card-border" />
          <div role="group" aria-label="Account type" className="flex flex-wrap gap-1.5">
            {GUIDE_ACCOUNTS.map((a) => (
              <button key={a.key} type="button" aria-pressed={account === a.key} onClick={() => { const n = account === a.key ? null : a.key; setAccount(n); remember(n, build); }} className={chip(account === a.key)}>
                {a.label}
              </button>
            ))}
          </div>
          <span className="h-6 w-px bg-card-border" />
          <div role="group" aria-label="Build" className="flex flex-wrap gap-1.5">
            {GUIDE_BUILDS.map((b) => (
              <button key={b.key} type="button" aria-pressed={build === b.key} onClick={() => { setBuild(b.key); remember(account, b.key); }} className={chip(build === b.key)}>
                {b.key === 'any' ? 'Any build' : b.key === 'pure' ? 'Pure 1 def' : b.key === 'zerker' ? 'Zerker' : b.key === 'med' ? 'Med' : 'Main'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {picks.length > 0 && !q && (
        <section className="space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
            <h2 className="text-lg font-bold">Picked for you</h2>
            {pickedFrom && <span className="text-[13px] text-text-muted">From your stats and kc on {pickedFrom}</span>}
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {picks.map((p) => (
              <ClanLink key={p.slug} href={`/guides/${p.slug}`} className="flex flex-col gap-3 rounded-xl border border-[#6b5326] bg-[#2a2114] p-4 hover:border-gold">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#6b5326] bg-card-bg">{p.icon ? <ItemSprite id={p.icon} size={36} /> : null}</span>
                  <div>
                    <strong className="block text-[15px]">{p.title}</strong>
                    <span className="text-xs text-text-muted">{p.level}</span>
                  </div>
                </div>
                <span className="text-lg font-extrabold text-gold">{p.stat}</span>
                <span className="border-t border-[#6b5326] pt-2.5 text-xs text-text-muted">{p.why}</span>
              </ClanLink>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="text-lg font-bold">All guides</h2>
          <span className="text-[13px] text-text-muted">
            {cards.length} guides · {totalSetups} setups · {totalCommunity} community setups
          </span>
        </div>
        {groups.length === 0 && <p className="rounded-xl border border-dashed border-card-border p-10 text-center text-sm text-text-muted">No guides match.</p>}
        {groups.map(({ cat, items }) => (
          <div key={cat.key} className="space-y-2.5">
            <div className="flex items-baseline gap-2.5">
              <h3 className="text-[15px] font-bold">
                {cat.icon} {cat.label}
              </h3>
              <span className="text-xs text-text-muted">
                {items.length} guide{items.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
              {items.map((g) => {
                const levels = new Set(g.setups.map((s) => s.tier)).size;
                return (
                  <ClanLink key={g.id} href={`/guides/${g.slug}`} className="flex items-center gap-2.5 rounded-xl border border-card-border bg-card-bg p-3 hover:border-gold/50">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2a2114]">{g.icon ? <ItemSprite id={g.icon} size={34} /> : <span className="text-xl">{cat.icon}</span>}</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="truncate text-sm">{g.title}</strong>
                      <span className="text-xs text-text-muted">
                        {g.kind === 'route' ? 'Progression route' : g.setups.length ? `${g.setups.length} setups · ${levels} level${levels === 1 ? '' : 's'}` : 'Guide'}
                      </span>
                      {g.community > 0 && <span className="text-xs text-gold">{g.community} community setups</span>}
                      {g.by && <span className="truncate text-[11px] text-text-muted">{g.by}</span>}
                    </span>
                  </ClanLink>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
