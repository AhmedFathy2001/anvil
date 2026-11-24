'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import LoadoutEditor, { DEFAULT_STATS } from '@/components/gear/LoadoutEditor';
import InventoryPanel, { useItemNames } from '@/components/gear/InventoryPanel';
import { useGearData } from '@/components/gear/useGearData';
import { clanFetch } from '@/lib/clanFetch';
import { useClanHref } from '@/lib/useClanPath';
import { setupLoadout } from '@/lib/dps/summary';
import { bestStyle } from '@/lib/dps/engine';
import { TIERS, type GearBlock, type GearSetup, type TierKey } from '@/lib/guideTiers';
import { EQUIPMENT_INDEX } from '@/lib/runeliteExport';
import SetupExtrasEditor from './SetupExtrasEditor';
import { BankTagPreviewToggle } from './osrs';

const draftKey = (guideId: number) => `anvil.guides.submit.${guideId}`;

/**
 * Submit a setup to a guide level. It shows at once as a community setup; curators can promote or
 * hide it. "Fill from my plugin" takes the worn gear and inventory the plugin last read (the
 * reader's own, owner-only); otherwise the existing picker. Drafts autosave in this browser.
 */
export default function SubmitSetup({ guide, block, initialTier, clanOnly }: { guide: { id: number; slug: string; title: string }; block: GearBlock | null; initialTier: TierKey; clanOnly: boolean }) {
  const router = useRouter();
  const clanHref = useClanHref();
  const { idx, error } = useGearData();
  const [setup, setSetup] = useState<GearSetup>(() => ({ tier: initialTier, name: '', gear: {}, style: 0, stats: DEFAULT_STATS[initialTier] }));
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [fillMsg, setFillMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = useItemNames([...(setup.inventory ?? []), ...(setup.runePouch ?? [])].map((x) => x?.id ?? 0).filter(Boolean));

  // Restore a draft, then keep saving it.
  useEffect(() => {
    try {
      const j = JSON.parse(localStorage.getItem(draftKey(guide.id)) ?? 'null') as { setup?: GearSetup; notes?: string } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (j?.setup?.gear) setSetup({ ...j.setup, tier: initialTier });
      if (j?.notes) setNotes(j.notes);
    } catch {
      /* storage unavailable */
    }
  }, [guide.id, initialTier]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(guide.id), JSON.stringify({ setup, notes }));
      } catch {
        /* storage unavailable */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [setup, notes, guide.id]);

  const monster = useMemo(() => (idx && block ? idx.monster(block.monsters?.[0] ?? block.monster) : null), [idx, block]);
  const result = idx && monster ? bestStyle(setupLoadout(setup), monster, idx.item, idx.rules)?.result ?? null : null;
  const patch = (p: Partial<GearSetup>) => setSetup((s) => ({ ...s, ...p }));

  async function fillFromPlugin() {
    const res = await clanFetch('/api/guides/me');
    const j = (await res.json().catch(() => ({}))) as { fill?: { equipment: { id: number }[]; inventory: { id: number; q?: number }[]; readAt: string | null } | null; error?: string };
    if (!res.ok) return setFillMsg(j.error ?? 'Sign in first.');
    if (!j.fill) return setFillMsg('Nothing from the plugin yet: it sends your worn gear and inventory once the guide update is in.');
    // Worn items to their slots by the gear data's own slot for each id.
    const gear: Record<string, number> = {};
    for (const it of j.fill.equipment) {
      const slot = idx?.item(it.id)?.s;
      const key = slot === '2h' ? 'weapon' : slot;
      if (key && key in EQUIPMENT_INDEX) gear[key] = it.id;
    }
    patch({ gear, inventory: j.fill.inventory.slice(0, 28) });
    setFillMsg(`Filled from your plugin${j.fill.readAt ? ` · read ${j.fill.readAt.slice(0, 16).replace('T', ' ')}` : ''}`);
  }

  async function publish() {
    setBusy(true);
    setMsg(null);
    const res = await clanFetch(`/api/guides/${guide.id}/setups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: setup.tier, setup, notes, clanOnly }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; firstToWrite?: boolean };
    setBusy(false);
    if (!res.ok) return setMsg(j.error ?? 'Could not publish it.');
    try {
      localStorage.removeItem(draftKey(guide.id));
    } catch {
      /* storage unavailable */
    }
    router.push(clanHref(`/guides/${guide.slug}`));
    router.refresh();
  }

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!idx) return <div className="h-64 animate-pulse rounded-xl border border-card-border bg-card-bg" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">{clanOnly ? 'Pin a clan setup' : 'Submit your setup'}</h1>
          <span className="text-sm text-text-muted">{guide.title}</span>
        </div>
        <ClanLink href={`/guides/${guide.slug}`} className="rounded-lg border border-card-border px-3 py-2 text-sm text-text-muted">
          Cancel
        </ClanLink>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#6b5326] bg-[#2a2114] p-3 text-sm">
        <span className="flex-1">
          <strong>Fill from your plugin:</strong> <span className="text-text-muted">{fillMsg ?? 'your worn gear and inventory, as the plugin last read them'}</span>
        </span>
        <button type="button" onClick={fillFromPlugin} className="h-9 rounded-lg border border-[#6b5326] px-3 text-xs font-semibold text-gold">
          Read again
        </button>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-semibold">Setup name</span>
        <Input value={setup.name} onChange={(e) => patch({ name: e.target.value.slice(0, 60) })} placeholder="Budget DHL melee" />
      </label>

      <div className="space-y-1.5 text-sm">
        <span className="font-semibold">Level</span>
        <div role="radiogroup" aria-label="Level" className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button key={t.key} type="button" role="radio" aria-checked={setup.tier === t.key} onClick={() => patch({ tier: t.key })} className={`h-11 rounded-[10px] border ${setup.tier === t.key ? 'border-gold bg-[#2a2114] font-bold text-gold' : 'border-card-border bg-black/20'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold">Equipment and levels</span>
        <LoadoutEditor
          value={setupLoadout(setup)}
          onChange={(l) => patch({ gear: l.gear as Record<string, number>, style: l.style, spell: l.spell ?? null, dart: l.dart ?? null, stats: l.stats, prayer: l.prayer ?? null, boost: l.boost ?? null, onTask: l.onTask ?? false })}
          idx={idx}
          monster={monster}
        />
        {result && (
          <p className="text-sm text-gold">
            DPS {result.dps.toFixed(2)} · ~{Number.isFinite(result.ttk) ? `${Math.floor(result.ttk / 60)}m ${Math.round(result.ttk % 60)}s` : '—'} per kill
          </p>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold">Inventory and rune pouch</span>
        <InventoryPanel inventory={setup.inventory} runePouch={setup.runePouch} names={names} onChange={(inventory) => patch({ inventory })} onRunePouch={(runePouch) => patch({ runePouch })} />
      </div>

      <SetupExtrasEditor value={setup} onChange={patch} idx={idx} names={names} />

      <BankTagPreviewToggle setup={{ name: `${guide.title} ${setup.name}`, gear: setup.gear, inventory: setup.inventory, runePouch: setup.runePouch, spellbook: setup.spellbook, quiver: setup.quiver }} names={names} />

      <label className="block space-y-1.5 text-sm">
        <span className="font-semibold">
          Short notes <span className="font-normal text-text-muted">(optional, 280 characters)</span>
        </span>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 280))} />
        <span className="block text-right text-xs text-text-muted">{notes.length} / 280</span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-card-border pt-4">
        <span className="flex-1 text-xs text-text-muted">{clanOnly ? 'Shows on your clan’s copy only.' : 'Shows right away; curators can promote or hide it. Draft saved in this browser.'}</span>
        {msg && <span className="text-xs text-red-300">{msg}</span>}
        <button type="button" disabled={busy || !setup.name.trim() || !Object.keys(setup.gear).length} onClick={publish} className="h-11 rounded-[10px] bg-gold px-5 text-sm font-bold text-brown-dark disabled:opacity-40">
          {clanOnly ? 'Pin to our copy' : 'Publish as community setup'}
        </button>
      </div>
    </div>
  );
}
