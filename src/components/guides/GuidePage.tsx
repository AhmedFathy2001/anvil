'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clanFetch } from '@/lib/clanFetch';

import ClanLink from '@/components/ClanLink';
import DialogFrame from '@/components/DialogFrame';
import Switch from '@/components/Switch';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import GearProgression from '@/components/gear/GearProgression';
import { renderGuide } from '@/lib/guideMarkdown';
import { TIERS, splitSegments, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import { GUIDE_ACCOUNTS, GUIDE_BUILDS, accountLabel, buildLabel, setupFit, defaultSetup, type GuideAccount, type GuideBuild } from '@/lib/guideSetups';
import { personalSetup, slotOptions } from '@/lib/gearOwnership';
import { bankTagString, inventorySetupJson, type ExportSetup } from '@/lib/runeliteExport';
import { groundMarkersJson, markerCountLabel, MARKERS_IMPORT_HINT } from '@/lib/groundMarkers';
import { formatGp } from '@/lib/itemPrices';
import { fmtDuration } from '@/lib/dps/summary';
import { BankTagPreviewToggle, InventoryGrid, ItemSprite, PaperDoll, RunePouchBox, SpellbookRow, WriterBadge, type Names, type QuillTone, type SlotNote } from './osrs';

// The wire shapes the server page hands over (lib/guideView, serialised).
export interface SetupWire {
  key: string;
  index: number;
  setup: GearSetup;
  fit: { ok: boolean; reason: string | null };
  resolved: { gear: Record<string, number>; quiver: number | null; slots: { slot: string; guide: number; use: number | null; kind: 'guide' | 'fallback' | 'missing'; options: number[] }[]; missingSupplies: { id: number; need: number; have: number }[] } | null;
  dps: number | null;
  ttk: number | null;
  myDps: number | null;
  community: boolean;
  twoHanded: boolean;
  hasQuiver: boolean;
  /** Item ids on this setup's slot lists the reader owns (any form). Empty when nothing is known. */
  owned: number[];
}
export interface LadderWire {
  slot: string;
  steps: { id: number; dps: number; gainPct: number | null; price: number | null; current: boolean }[];
  next: { id: number; gainPct: number; price: number | null; perMillion: number | null } | null;
}
export interface CommunityWire {
  id: number;
  key: string;
  tier: TierKey;
  setup: GearSetup;
  notes: string | null;
  author: string;
  status: string;
  clanOnly: boolean;
  score: number;
  voters: number;
  avgKc: number;
  mine: boolean;
}
export interface TipWire {
  id: number;
  kind: 'tip' | 'mistake';
  tier: string | null;
  text: string;
  author: string;
  useful: number;
  mine: boolean;
}
export interface WriterWire {
  name: string;
  tone: QuillTone | null;
  supporter: boolean;
  rank: string | null;
}

export interface GuidePageProps {
  guide: { id: number; slug: string; title: string; summary: string; body: string; updatedAt: string | null; staleNote: string | null; categoryLabel: string };
  block: GearBlock | null;
  setups: SetupWire[];
  ladders: Record<string, LadderWire[]>;
  prices: Record<number, number>;
  names: Names;
  community: CommunityWire[];
  tips: TipWire[];
  credit: { line: string; top: WriterWire[]; total: number; copyLine: string | null };
  wanted: { tier: string | null; accountType: string | null; build: string | null; requesters: number }[];
  viewer: {
    signedIn: boolean;
    rsn: string | null;
    account: GuideAccount | null;
    build: GuideBuild | null;
    levels: Record<string, number> | null;
    openTier: TierKey | null;
    kc: number | null;
    snapshotAt: string | null;
    skipped: { itemId: number; reason: string }[];
    budgetCap: number | null;
  };
  canCurate: boolean;
  kcLabel: string | null;
}

const chip = (on: boolean) =>
  `h-8 rounded-full border px-3 text-xs transition-colors ${on ? 'border-gold bg-gold font-semibold text-brown-dark' : 'border-card-border bg-card-bg text-foreground hover:border-gold/50'}`;
const SLOT_NAME: Record<string, string> = { head: 'Head', cape: 'Cape', neck: 'Neck', ammo: 'Ammo', weapon: 'Weapon', body: 'Body', shield: 'Shield', legs: 'Legs', hands: 'Hands', feet: 'Feet', ring: 'Ring', quiver: 'Quiver' };
const PREF = 'anvil.guides.filters';

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  const res = await clanFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ...j, ok: res.ok, error: typeof j.error === 'string' ? j.error : undefined };
}

function exportOf(title: string, s: GearSetup): ExportSetup {
  const tier = TIERS.find((t) => t.key === s.tier)?.label ?? '';
  return { name: `${title.split(' — ')[0]} ${tier} ${s.name}`.replace(/\s+/g, ' ').trim(), gear: s.gear, inventory: s.inventory, runePouch: s.runePouch, spellbook: s.spellbook, notes: s.note, quiver: s.quiver };
}

export default function GuidePage(p: GuidePageProps) {
  const router = useRouter();
  const main = p.setups.filter((s) => !s.community);
  const tiersWithSetups = TIERS.filter((t) => main.some((s) => s.setup.tier === t.key));
  const [tier, setTier] = useState<TierKey>(p.viewer.openTier && tiersWithSetups.some((t) => t.key === p.viewer.openTier) ? p.viewer.openTier : (tiersWithSetups[0]?.key ?? 'beginner'));
  const [account, setAccount] = useState<GuideAccount | null>(p.viewer.account);
  const [build, setBuild] = useState<GuideBuild>(p.viewer.build ?? 'any');
  const [sel, setSel] = useState<number | null>(null);
  const [mineOn, setMineOn] = useState(true);
  const [sort, setSort] = useState<'order' | 'gp'>('order');
  const [copied, setCopied] = useState<string | null>(null);
  const [alt, setAlt] = useState<{ setup: SetupWire; slot: string } | null>(null);

  // The reader's filter choice, across guides (a convenience; the page works without it).
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(PREF) ?? 'null') as { account?: GuideAccount; build?: GuideBuild } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (j?.account && !p.viewer.account) setAccount(j.account);
      if (j?.build && !p.viewer.build) setBuild(j.build);
    } catch {
      /* storage unavailable */
    }
  }, [p.viewer.account, p.viewer.build]);
  const remember = (a: GuideAccount | null, b: GuideBuild) => {
    try {
      localStorage.setItem(PREF, JSON.stringify({ account: a, build: b }));
    } catch {
      /* storage unavailable */
    }
  };
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 5000);
    return () => clearTimeout(t);
  }, [copied]);

  const filters = useMemo(() => ({ account, build, levels: p.viewer.levels }), [account, build, p.viewer.levels]);
  const pills = main.filter((s) => s.setup.tier === tier).map((s) => ({ ...s, fit: setupFit(s.setup, filters) }));
  const dflt = defaultSetup(pills.map((x) => x.setup), filters);
  const current = pills[sel != null && sel < pills.length ? sel : Math.max(0, dflt)] ?? null;
  const allBlocked = pills.length > 0 && pills.every((x) => !x.fit.ok);
  const useMine = mineOn && !!current?.resolved;
  const shown = current ? (useMine ? personalSetup(current.setup, { ...current.resolved!, slots: [], missing: [], fallbacks: [], missingSupplies: [] }) : current.setup) : null;

  const notes: Record<string, SlotNote> = {};
  if (current?.resolved && useMine) {
    for (const sl of current.resolved.slots) {
      if (sl.kind === 'fallback' && sl.use) notes[sl.slot] = { kind: 'fallback', text: `You'll use ${p.names[sl.use] ?? 'a fallback'}` };
      if (sl.kind === 'missing') notes[sl.slot] = { kind: 'missing', text: 'Not in your bank, inventory or worn gear' };
    }
  }
  const missing = current?.resolved ? current.resolved.slots.filter((s) => s.kind === 'missing' && s.use) : [];
  const fallbacksInUse = current?.resolved && useMine ? current.resolved.slots.filter((s) => s.kind === 'fallback') : [];
  const markers = current ? (current.setup.markers?.length ? current.setup.markers : p.block?.markers?.[current.setup.tier] ?? []) : [];

  async function copy(kind: 'banktag' | 'setup' | 'markers') {
    if (!shown) return;
    const ex = exportOf(p.guide.title, shown);
    const text = kind === 'banktag' ? bankTagString(ex) : kind === 'setup' ? inventorySetupJson(ex) : groundMarkersJson(markers);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind === 'banktag' ? 'Bank tag copied — in the bank, right-click the + tab → Import tag tab.' : kind === 'setup' ? 'Copied — in the Inventory Setups panel, choose Import setup.' : `Tile markers copied. ${MARKERS_IMPORT_HINT}.`);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  // The level's own text sections ("How to do it") when the setup has no steps of its own.
  const tierText = useMemo(() => splitSegments(p.guide.body).filter((s) => s.kind === 'text' && s.tier === tier).map((s) => s.text).join('\n\n'), [p.guide.body, tier]);
  const shared = useMemo(() => splitSegments(p.guide.body).filter((s) => s.kind === 'text' && !s.tier).map((s) => s.text).join('\n\n'), [p.guide.body]);
  const ladder = current ? p.ladders[current.key] ?? [] : [];
  const ladderRows = sort === 'gp' ? [...ladder].sort((a, b) => (b.next?.perMillion ?? -1) - (a.next?.perMillion ?? -1)) : ladder;
  const comm = p.community.filter((c) => c.tier === tier);
  const tips = p.tips.filter((t) => !t.tier || t.tier === tier);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <ClanLink href="/guides" className="text-xs text-text-muted hover:text-gold">
          ‹ Guides / {p.guide.categoryLabel}
        </ClanLink>
        <div>
          <h1 className="text-3xl font-extrabold">{p.guide.title}</h1>
          {p.guide.summary && <p className="mt-1 text-sm text-text-muted">{p.guide.summary}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            {p.credit.copyLine ? <span>{p.credit.copyLine}</span> : p.credit.line && <span>{p.credit.line}</span>}
            {p.credit.top.map((w) => (
              <span key={w.name} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-foreground">
                {w.tone && <WriterBadge tone={w.tone} supporter={w.supporter} title={w.rank ?? 'Writer'} />}
                {w.name}
              </span>
            ))}
            {p.guide.updatedAt && <span>· updated {p.guide.updatedAt.slice(0, 10)}</span>}
            <ClanLink href={`/guides/propose?edit=${p.guide.id}`} className="text-gold hover:underline">
              Suggest an edit
            </ClanLink>
          </p>
          {p.guide.staleNote && <p className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">May be out of date: {p.guide.staleNote}</p>}
        </div>
        {shared && <div className="max-w-3xl text-[15px] leading-relaxed text-gray-200">{renderGuide(shared)}</div>}
      </header>

      {main.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-card-border">
            <div role="tablist" aria-label="Level" className="flex gap-1">
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tier === t.key}
                  onClick={() => {
                    setTier(t.key);
                    setSel(null);
                  }}
                  className={`-mb-px flex h-11 items-center gap-2 border-b-2 px-4 text-sm ${tier === t.key ? 'border-gold font-bold text-gold' : 'border-transparent text-text-muted hover:text-foreground'}`}
                >
                  {t.label}
                  {p.viewer.openTier === t.key && <span className="rounded-full bg-gold/15 px-1.5 text-[10px] font-semibold text-gold">yours</span>}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pb-2">
              {GUIDE_ACCOUNTS.map((a) => (
                <button key={a.key} type="button" aria-pressed={account === a.key} onClick={() => { const n = account === a.key ? null : a.key; setAccount(n); setSel(null); remember(n, build); }} className={chip(account === a.key)}>
                  {a.label}
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-card-border" />
              {GUIDE_BUILDS.map((b) => (
                <button key={b.key} type="button" aria-pressed={build === b.key} onClick={() => { setBuild(b.key); setSel(null); remember(account, b.key); }} className={chip(build === b.key)}>
                  {b.key === 'any' ? 'Any build' : b.label.split(' ')[0] === 'Pure' ? 'Pure 1 def' : b.label.replace(/ \d+ def| level| build/, '')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">
              {pills.length} setup{pills.length === 1 ? '' : 's'} for {TIERS.find((t) => t.key === tier)?.label}:
            </span>
            {pills.map((x, i) => {
              const on = x === current;
              return (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSel(i)}
                  title={x.fit.reason ?? undefined}
                  className={`flex min-h-10 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] ${
                    !x.fit.ok
                      ? on
                        ? 'border border-dashed border-text-muted bg-card-bg text-text-muted'
                        : 'border border-dashed border-card-border bg-black/20 text-text-muted/70'
                      : on
                        ? 'border border-gold bg-[#2a2114] font-bold text-gold'
                        : 'border border-card-border bg-card-bg hover:border-gold/50'
                  }`}
                >
                  {x.setup.pick && <span className="text-gold" aria-label="Curator pick">★</span>}
                  <span>{x.setup.name}</span>
                  {x.setup.tag && <span className="rounded bg-white/5 px-1.5 text-[11px] font-normal text-text-muted">{x.setup.tag}</span>}
                  {!x.fit.ok && <span className="text-[11px] font-normal">· {x.fit.reason}</span>}
                </button>
              );
            })}
          </div>
          {allBlocked && (
            <p className="text-sm text-text-muted">
              No setup at this level fits {account ? accountLabel(account) : ''} {build !== 'any' ? buildLabel(build) : ''} yet.{' '}
              <ClanLink href={`/guides/${p.guide.slug}/submit?tier=${tier}`} className="text-gold hover:underline">
                Submit one
              </ClanLink>
            </p>
          )}

          {current && shown && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5 rounded-xl border border-card-border bg-card-bg p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
                  <h2 className="text-lg font-bold">{current.setup.name}</h2>
                  {current.setup.by && <span className="text-xs text-text-muted">by {current.setup.by.name}</span>}
                  {current.setup.pick && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">Curator pick</span>}
                  {current.resolved && (
                    <span className="ml-auto flex items-center gap-2 text-xs text-text-muted">
                      <Switch checked={mineOn} onChange={setMineOn}>
                        {mineOn ? 'Your version (from what you own)' : "Guide's version"}
                      </Switch>
                    </span>
                  )}
                </div>
                {fallbacksInUse.length > 0 && (
                  <p className="text-xs text-text-muted">
                    ↓ Using {fallbacksInUse.length} fallback{fallbacksInUse.length === 1 ? '' : 's'}:{' '}
                    {fallbacksInUse.map((f) => `${p.names[f.use!] ?? 'item'} for ${p.names[f.guide] ?? 'item'}`).join(' · ')}
                  </p>
                )}
                <div className="flex flex-wrap items-start gap-6">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-text-muted">Equipment</div>
                    <div className="rounded border border-[#14100b] border-t-2 border-t-gold bg-[#3e3529] p-3 shadow-[inset_0_0_0_1px_#54483a]">
                      <PaperDoll
                        gear={shown.gear}
                        quiver={shown.quiver}
                        hasQuiver={current.hasQuiver}
                        twoHanded={current.twoHanded}
                        names={p.names}
                        notes={notes}
                        onSlot={(slot) => setAlt({ setup: current, slot })}
                      />
                    </div>
                    <p className="text-[11px] text-text-muted">Click a slot for its alternatives.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-text-muted">Inventory</div>
                    <InventoryGrid inventory={shown.inventory} names={p.names} />
                  </div>
                  <div className="min-w-[200px] flex-1 space-y-3">
                    {!!shown.runePouch?.length && (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-widest text-text-muted">Rune pouch</div>
                        <RunePouchBox runes={shown.runePouch} divine={shown.runePouch.length > 3 || !!shown.inventory?.some((i) => i?.id === 27281)} names={p.names} />
                      </div>
                    )}
                    {(shown.spellbook != null || !!shown.spells?.length) && (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-widest text-text-muted">Spellbook</div>
                        <SpellbookRow spellbook={shown.spellbook} spells={shown.spells} />
                      </div>
                    )}
                    {shown.note && <p className="text-xs text-text-muted">{shown.note}</p>}
                  </div>
                </div>
                <div className="space-y-2 border-t border-card-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => copy('banktag')} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-brown-dark hover:bg-gold-light">
                      Copy bank tag
                    </button>
                    <button type="button" onClick={() => copy('setup')} className="rounded-lg border border-gold/50 px-3 py-2 text-sm text-gold hover:bg-gold/10">
                      Copy Inventory Setup
                    </button>
                    {markers.length > 0 && (
                      <button type="button" onClick={() => copy('markers')} className="rounded-lg border border-card-border px-3 py-2 text-sm hover:border-gold/50">
                        Copy tile markers · {markerCountLabel(markers.length)}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {useMine ? 'Your version, from what you own. ' : ''}Paste in RuneLite: Bank Tags → Import tag tab{markers.length ? ` · tile markers: right-click the world map orb → Import Ground Markers` : ''}
                  </p>
                  {copied && <p className="rounded border border-emerald-900/60 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-200">{copied}</p>}
                  <BankTagPreviewToggle setup={exportOf(p.guide.title, shown)} names={p.names} />
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-card-border bg-card-bg p-4">
                  <div className="text-[11px] uppercase tracking-widest text-text-muted">With this setup</div>
                  <div className="mt-2 flex items-end gap-5">
                    <div>
                      <div className="text-2xl font-extrabold text-gold">{(useMine ? current.myDps : current.dps)?.toFixed(2) ?? '—'}</div>
                      <div className="text-[11px] text-text-muted">DPS</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">{current.ttk != null ? `~${fmtDuration(current.ttk)}` : '—'}</div>
                      <div className="text-[11px] text-text-muted">per kill (guide&apos;s gear)</div>
                    </div>
                  </div>
                  {useMine && current.myDps != null && current.dps != null && current.myDps !== current.dps && (
                    <p className="mt-1 text-[11px] text-text-muted">Guide&apos;s version: {current.dps.toFixed(2)} DPS</p>
                  )}
                </div>
                <div className="rounded-xl border border-card-border bg-card-bg p-4">
                  <h3 className="text-sm font-bold">{missing.length ? `Missing for this setup (${missing.length})` : 'Missing for this setup'}</h3>
                  {p.viewer.snapshotAt ? (
                    <>
                      <p className="text-[11px] text-text-muted">Checked your bank, inventory and worn gear, read by the plugin {p.viewer.snapshotAt.slice(0, 10)}</p>
                      <ul className="mt-2 space-y-1.5">
                        {missing.map((m) => (
                          <li key={m.slot} className="flex items-center gap-2 text-xs">
                            <ItemSprite id={m.use!} name={p.names[m.use!]} size={28} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{p.names[m.use!] ?? 'Item'}</span>
                              <span className="text-text-muted">{p.prices[m.use!] ? `~${formatGp(p.prices[m.use!])} on the GE` : 'untradeable'}</span>
                            </span>
                          </li>
                        ))}
                        {current.resolved?.missingSupplies.map((m) => (
                          <li key={`s${m.id}`} className="flex items-center gap-2 text-xs">
                            <ItemSprite id={m.id} name={p.names[m.id]} size={24} />
                            <span className="text-text-muted">{p.names[m.id] ?? 'Supply'} (0 held)</span>
                          </li>
                        ))}
                      </ul>
                      {!missing.length && !current.resolved?.missingSupplies.length && <p className="mt-2 text-xs text-emerald-300">You own every item in this setup.</p>}
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-text-muted">
                      {p.viewer.signedIn ? 'When the plugin reads your bank, this lists what you still need.' : 'Sign in and use the plugin to see what you still need.'}
                    </p>
                  )}
                </div>
                <SkippedList skipped={p.viewer.skipped} budgetCap={p.viewer.budgetCap} names={p.names} signedIn={p.viewer.signedIn} onChange={() => router.refresh()} />
              </aside>
            </div>
          )}
        </section>
      )}

      {current && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
            How to do it <span className="text-sm font-normal text-text-muted">{current.setup.name}</span>
          </h2>
          {current.setup.steps?.length ? (
            <ol className="ml-5 list-decimal space-y-2 text-[15px] text-gray-200">
              {current.setup.steps.map((st, i) => (
                <li key={i}>{renderGuide(st)}</li>
              ))}
            </ol>
          ) : tierText ? (
            <div className="max-w-3xl text-[15px] leading-relaxed text-gray-200">{renderGuide(tierText)}</div>
          ) : (
            <p className="text-sm text-text-muted">No steps for this level yet.</p>
          )}
        </section>
      )}

      <TipsSection guideId={p.guide.id} tier={tier} tips={tips} signedIn={p.viewer.signedIn} canCurate={p.canCurate} onChange={() => router.refresh()} />

      {ladderRows.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
              Gear progression
            </h2>
            <span className="text-xs text-text-muted">gold outline = {current?.resolved ? 'what you have' : "this setup's item"}</span>
            <div role="group" aria-label="Sort" className="ml-auto flex overflow-hidden rounded-lg border border-card-border text-xs">
              <button type="button" aria-pressed={sort === 'gp'} onClick={() => setSort('gp')} className={`h-9 px-3 ${sort === 'gp' ? 'bg-[#2a2114] font-bold text-gold' : 'text-text-muted'}`}>
                By DPS per gp
              </button>
              <button type="button" aria-pressed={sort === 'order'} onClick={() => setSort('order')} className={`h-9 px-3 ${sort === 'order' ? 'bg-[#2a2114] font-bold text-gold' : 'text-text-muted'}`}>
                By order
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {ladderRows.map((row) => {
              const ci = row.steps.findIndex((s) => s.current);
              return (
                <div key={row.slot} className="rounded-xl border border-card-border bg-card-bg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="w-16 text-sm">{SLOT_NAME[row.slot]}</strong>
                    {row.steps.map((st, i) => (
                      <span key={st.id} className="flex items-center gap-2">
                        {i > 0 && <span aria-hidden className="text-text-muted">→</span>}
                        <span
                          className={`flex items-center gap-2 rounded-[10px] py-1.5 pl-1.5 pr-2.5 ${
                            st.current ? 'border-2 border-gold bg-[#2a2114]' : i === ci + 1 ? 'border border-dashed border-gold bg-card-bg' : `border border-card-border bg-card-bg ${i < ci ? 'opacity-60' : ''}`
                          }`}
                        >
                          <ItemSprite id={st.id} name={p.names[st.id]} size={28} />
                          <span className="text-xs">
                            <strong className="block">{p.names[st.id] ?? 'Item'}</strong>
                            <span className="text-text-muted">
                              <span className="text-emerald-300">{st.gainPct == null ? 'base' : `+${st.gainPct}% DPS`}</span> · {st.price ? formatGp(st.price) : 'untradeable'}
                            </span>
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                  {row.next && (
                    <p className="mt-1.5 text-[11px] text-text-muted">
                      next: +{row.next.gainPct}% DPS {row.next.price ? `for ${formatGp(row.next.price)}` : '· untradeable'}
                      {row.next.perMillion != null ? ` · ${row.next.perMillion}% per 1m` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden className="h-5 w-1 rounded-full bg-gold" />
            Community setups
          </h2>
          <span className="text-xs text-text-muted">
            Ranked by players who used them · {comm.length} for {TIERS.find((t) => t.key === tier)?.label}
          </span>
          <ClanLink href={`/guides/${p.guide.slug}/submit?tier=${tier}`} className="ml-auto rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-gold hover:bg-gold/10">
            Submit your setup
          </ClanLink>
        </div>
        {comm.length === 0 ? (
          <p className="rounded-xl border border-dashed border-card-border p-6 text-center text-sm text-text-muted">No community setups for this level yet.</p>
        ) : (
          <div className="space-y-2">
            {comm.map((c) => (
              <CommunityRow key={c.id} c={c} guideId={p.guide.id} title={p.guide.title} names={p.names} signedIn={p.viewer.signedIn} kcLabel={p.kcLabel} onChange={() => router.refresh()} />
            ))}
          </div>
        )}
        <p className="text-[11px] text-text-muted">
          Community setups show right away. &quot;Used it&quot; counts carry each voter&apos;s {p.kcLabel ?? 'boss'} kc. Curators can promote a setup to a main one.
        </p>
      </section>

      {p.wanted.length > 0 && (
        <section className="rounded-xl border border-gold/30 bg-[#2a2114] p-4 text-sm">
          <strong>Wanted for this guide:</strong>{' '}
          {p.wanted.map((w) => [w.tier && TIERS.find((t) => t.key === w.tier)?.label, w.accountType && accountLabel(w.accountType), w.build && buildLabel(w.build)].filter(Boolean).join(' · ') || 'any setup').join(', ')}
          {' — '}
          <ClanLink href={`/guides/${p.guide.slug}/submit`} className="text-gold hover:underline">
            add one (first to write it gets extra credit)
          </ClanLink>
        </section>
      )}

      {p.block && (
        <details className="rounded-xl border border-card-border bg-card-bg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Your own gear calculator</summary>
          <div className="px-2 pb-2">
            <GearProgression block={p.block} tier={tier} storageKey={`guide:${p.guide.id}:${p.block.monster}`} />
          </div>
        </details>
      )}

      {alt && (
        <AlternativesDialog
          setup={alt.setup}
          slot={alt.slot}
          names={p.names}
          prices={p.prices}
          skipped={p.viewer.skipped}
          signedIn={p.viewer.signedIn}
          ladder={p.ladders[alt.setup.key] ?? []}
          onClose={() => setAlt(null)}
          onChange={() => router.refresh()}
        />
      )}
    </div>
  );
}

function CommunityRow({ c, guideId, title, names, signedIn, kcLabel, onChange }: { c: CommunityWire; guideId: number; title: string; names: Names; signedIn: boolean; kcLabel: string | null; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const weapon = c.setup.gear.weapon;
  const tags = [TIERS.find((t) => t.key === c.tier)?.label, c.setup.accounts?.map(accountLabel).join('/'), c.setup.builds?.map(buildLabel).join('/'), c.setup.tag].filter(Boolean).join(' · ');
  async function vote() {
    const r = await post(`/api/guides/${guideId}/votes`, { setupKey: c.key, on: !c.mine });
    if (!r.ok) return setMsg(r.error ?? 'Could not vote.');
    onChange();
  }
  async function report() {
    const reason = window.prompt('What is wrong with this setup?');
    if (!reason) return;
    const r = await post(`/api/guides/contributions/${c.id}`, { action: 'report', reason });
    setMsg(r.ok ? 'Thanks — a curator will look.' : r.error ?? 'Could not report.');
  }
  async function copyTag() {
    const text = bankTagString(exportOf(title, c.setup));
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Bank tag copied.');
    } catch {
      window.prompt('Copy this:', text);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border bg-card-bg p-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#2a2114]">{weapon ? <ItemSprite id={weapon} name={names[weapon]} size={34} /> : null}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <strong className="truncate">{c.setup.name}</strong>
          {c.status === 'promoted' && <span className="rounded-full bg-gold/15 px-2 text-[11px] text-gold">Curator pick</span>}
          {c.clanOnly && <span className="rounded-full bg-white/5 px-2 text-[11px] text-text-muted">Clan setup</span>}
        </div>
        <div className="truncate text-xs text-text-muted">
          by {c.author} · {tags}
        </div>
        {c.notes && <div className="text-xs text-text-muted">{c.notes}</div>}
        {msg && <div className="text-xs text-amber-200">{msg}</div>}
      </div>
      <div className="text-right text-xs">
        <strong className="block text-sm">{c.voters} used</strong>
        <span className="text-text-muted">{c.voters ? `avg ${c.avgKc} ${kcLabel ?? ''} kc` : 'no votes yet'}</span>
      </div>
      <div className="flex gap-1.5">
        <button type="button" onClick={copyTag} className="h-9 rounded-lg border border-card-border px-2.5 text-xs hover:border-gold/50">
          Copy tag
        </button>
        <button type="button" onClick={vote} disabled={!signedIn} aria-pressed={c.mine} className={`h-9 rounded-lg px-2.5 text-xs font-semibold ${c.mine ? 'border border-gold bg-gold/15 text-gold' : 'bg-gold text-brown-dark'} disabled:opacity-40`} title={signedIn ? undefined : 'Sign in to vote'}>
          {c.mine ? 'Used it ✓' : 'Used it'}
        </button>
        {signedIn && (
          <button type="button" onClick={report} className="h-9 rounded-lg px-2 text-xs text-text-muted hover:text-red-300">
            Report
          </button>
        )}
      </div>
    </div>
  );
}

function TipsSection({ guideId, tier, tips, signedIn, canCurate, onChange }: { guideId: number; tier: TierKey; tips: TipWire[]; signedIn: boolean; canCurate: boolean; onChange: () => void }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'tip' | 'mistake'>('tip');
  const [msg, setMsg] = useState<string | null>(null);
  const t = tips.filter((x) => x.kind === 'tip');
  const m = tips.filter((x) => x.kind === 'mistake');
  async function add() {
    const r = await post(`/api/guides/${guideId}/tips`, { kind, tier, text });
    if (!r.ok) return setMsg(r.error ?? 'Could not add it.');
    setText('');
    setMsg(null);
    onChange();
  }
  const act = async (id: number, action: string) => {
    const r = await post(`/api/guides/tips/${id}`, { action, ...(action === 'report' ? { reason: window.prompt('What is wrong with it?') ?? '' } : {}) });
    if (!r.ok) setMsg(r.error ?? 'Could not do that.');
    else onChange();
  };
  const list = (rows: TipWire[]) => (
    <ul className="space-y-2">
      {rows.map((x) => (
        <li key={x.id} className="flex items-start gap-2 text-sm">
          <span className="min-w-0 flex-1">
            {x.text}
            <span className="block text-[11px] text-text-muted">
              {x.kind === 'tip' ? 'tip' : 'from'} by {x.author}
              {x.useful ? ` · ${x.useful} player${x.useful === 1 ? '' : 's'} found it useful` : ''}
            </span>
          </span>
          {signedIn && (
            <span className="flex shrink-0 gap-1 text-[11px]">
              <button type="button" onClick={() => act(x.id, 'useful')} className={`rounded border px-1.5 py-0.5 ${x.mine ? 'border-gold text-gold' : 'border-card-border text-text-muted hover:text-gold'}`}>
                Useful
              </button>
              <button type="button" onClick={() => act(x.id, 'report')} className="px-1 text-text-muted hover:text-red-300">
                Report
              </button>
              {canCurate && (
                <button type="button" onClick={() => act(x.id, 'hide')} className="px-1 text-text-muted hover:text-red-300">
                  Hide
                </button>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="font-bold">Tips</h3>
        {t.length ? list(t) : <p className="text-xs text-text-muted">No tips yet.</p>}
      </div>
      <div className="space-y-2 rounded-xl border border-card-border bg-card-bg p-4">
        <h3 className="font-bold">Common mistakes</h3>
        {m.length ? list(m) : <p className="text-xs text-text-muted">None noted yet.</p>}
      </div>
      {signedIn && (
        <div className="space-y-2 md:col-span-2">
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={kind === 'tip'} onClick={() => setKind('tip')} className={chip(kind === 'tip')}>
              Add a tip
            </button>
            <button type="button" aria-pressed={kind === 'mistake'} onClick={() => setKind('mistake')} className={chip(kind === 'mistake')}>
              Add a common mistake
            </button>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} rows={2} placeholder="Short and static: what to bring, what to watch for. No timers." />
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-text-muted">{text.length} / 280</span>
            {msg && <span className="text-xs text-amber-200">{msg}</span>}
            <button type="button" disabled={text.trim().length < 8} onClick={add} className="ml-auto rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark disabled:opacity-40">
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SkippedList({ skipped, budgetCap, names, signedIn, onChange }: { skipped: { itemId: number; reason: string }[]; budgetCap: number | null; names: Names; signedIn: boolean; onChange: () => void }) {
  const [cap, setCap] = useState(budgetCap ? formatGp(budgetCap) : '');
  if (!signedIn) return null;
  async function saveCap() {
    const m = /^\s*(\d+(?:\.\d+)?)\s*([kmb])?\s*$/i.exec(cap);
    const gp = m ? Math.floor(Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase() as 'k'] ?? 1)) : null;
    await post('/api/guides/me', { action: 'budget', gp });
    onChange();
  }
  return (
    <div className="space-y-2 rounded-xl border border-card-border bg-card-bg p-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-semibold">Budget cap</span>
        <Input aria-label="Budget cap" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="e.g. 50m" className="h-8 w-20 px-2 py-0 text-center text-gold" />
        <button type="button" onClick={saveCap} className="h-8 rounded border border-card-border px-2 hover:border-gold/50">
          Set
        </button>
      </div>
      <p className="text-text-muted">Items over the cap that you don&apos;t own fall back to the next pick, in every guide.</p>
      {skipped.length > 0 && (
        <div className="space-y-1 border-t border-card-border pt-2">
          <div className="font-semibold">Skipped items ({skipped.length})</div>
          {skipped.map((s) => (
            <div key={s.itemId} className="flex items-center gap-2">
              <ItemSprite id={s.itemId} name={names[s.itemId]} size={22} />
              <span className="flex-1 truncate">{names[s.itemId] ?? `Item ${s.itemId}`}</span>
              <button type="button" onClick={async () => { await post('/api/guides/me', { action: 'unskip', itemId: s.itemId }); onChange(); }} className="text-gold hover:underline">
                undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A slot's alternatives: icon, price, DPS change vs the guide's item, owned or not; skip an item. */
function AlternativesDialog({ setup, slot, names, prices, skipped, signedIn, ladder, onClose, onChange }: { setup: SetupWire; slot: string; names: Names; prices: Record<number, number>; skipped: { itemId: number }[]; signedIn: boolean; ladder: LadderWire[]; onClose: () => void; onChange: () => void }) {
  const row = ladder.find((r) => r.slot === slot);
  const dpsOf = (id: number) => row?.steps.find((s) => s.id === id)?.dps ?? null;
  const options = slotOptions(setup.setup, slot as 'head');
  const pick = setup.resolved?.slots.find((s) => s.slot === slot);
  const [reason, setReason] = useState<'cant_afford' | 'dont_want'>('cant_afford');
  const guideItem = options[0];
  async function skip(itemId: number) {
    await post('/api/guides/me', { action: 'skip', itemId, reason });
    onChange();
    onClose();
  }
  return (
    <DialogFrame dirty={false} onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" panelClassName="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-4" ariaLabel={`Alternatives for ${SLOT_NAME[slot]}`}>
      {(close) => (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <strong className="flex-1">Alternatives · {SLOT_NAME[slot]} slot</strong>
            <button type="button" onClick={close} className="h-8 w-8 rounded border border-card-border text-text-muted" aria-label="Close">
              ×
            </button>
          </div>
          <ul className="space-y-1.5">
            {options.map((id, i) => {
              const inUse = pick?.use === id || (!pick && i === 0);
              const owned = setup.owned.includes(id);
              const base = dpsOf(guideItem);
              const mine = dpsOf(id);
              const delta = i > 0 && base && mine != null ? Math.round(((mine - base) / base) * 100) : null;
              const isSkipped = skipped.some((s) => s.itemId === id);
              return (
                <li key={id} className={`flex items-center gap-2 rounded-lg p-2 ${inUse ? 'border border-gold bg-[#2a2114]' : 'border border-card-border'}`}>
                  <ItemSprite id={id} name={names[id]} size={30} />
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block truncate text-sm">{names[id] ?? `Item ${id}`}</span>
                    <span className="text-text-muted">
                      <span className="text-gold">{prices[id] ? formatGp(prices[id]) : 'untradeable'}</span> · {i === 0 ? "guide's pick" : delta != null ? `${delta >= 0 ? '+' : ''}${delta}% DPS` : `fallback ${i}`}
                      {isSkipped ? ' · skipped' : ''}
                    </span>
                    {owned && <span className="block font-semibold text-emerald-300">owned ✓</span>}
                  </span>
                  {signedIn && !isSkipped && i < options.length - 1 && (
                    <button type="button" onClick={() => skip(id)} className="h-7 rounded border border-card-border px-2 text-[11px] hover:border-gold/50">
                      Skip
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {options.length < 2 && <p className="text-xs text-text-muted">The guide lists no fallback for this slot.</p>}
          {signedIn && options.length > 1 && (
            <div className="space-y-1.5 border-t border-card-border pt-2 text-xs">
              <div className="font-semibold">Skip reason</div>
              <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
                {(['cant_afford', 'dont_want'] as const).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={chip(reason === r)}>
                    {r === 'cant_afford' ? "Can't afford" : "Don't want"}
                  </button>
                ))}
              </div>
              <p className="text-text-muted">Skipped items fall back to your next owned pick in every guide. Undo from &quot;Skipped items&quot;.</p>
              {guideItem && !setup.resolved && <p className="text-text-muted">Sign in with the plugin connected to see what you own.</p>}
            </div>
          )}
        </div>
      )}
    </DialogFrame>
  );
}
