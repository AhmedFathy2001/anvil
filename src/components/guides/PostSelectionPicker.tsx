'use client';

import { useMemo } from 'react';

import Checkbox from '@/components/Checkbox';
import Switch from '@/components/Switch';
import { useGearData } from '@/components/gear/useGearData';
import { discordBody } from '@/lib/dps/summary';
import { renderGuideForDiscord } from '@/lib/guideDiscord';
import { accountLabel, buildLabel, setupKey } from '@/lib/guideSetups';
import { selectAll, type PostSelection } from '@/lib/guideSelection';
import { TIERS, firstGearBlock } from '@/lib/guideTiers';
import { ItemSprite } from './osrs';

/**
 * Which parts of a guide go to Discord: a checklist grouped by level, setup names with their
 * account/build tags, All / None per level, "Also post setups added later", and a live count of
 * the messages it becomes. The site page always shows everything; this only filters the post.
 */
export default function PostSelectionPicker({ body, title, value, onChange }: { body: string; title: string; value: PostSelection | null; onChange: (v: PostSelection) => void }) {
  const block = useMemo(() => firstGearBlock(body), [body]);
  const { idx } = useGearData();
  const sel = value ?? selectAll(block);
  const setups = (block?.setups ?? []).map((s, i) => ({ s, key: setupKey(s, i) }));
  const count = useMemo(() => renderGuideForDiscord({ title, body: discordBody(body, idx, null, { selection: sel, title }) }).length, [body, idx, sel, title]);
  if (!block) return null;
  const toggleTier = (tier: (typeof TIERS)[number]['key'], on: boolean) => {
    const keys = setups.filter((x) => x.s.tier === tier).map((x) => x.key);
    onChange({
      ...sel,
      tiers: on ? [...new Set([...sel.tiers, tier])] : sel.tiers.filter((t) => t !== tier),
      setups: on ? [...new Set([...sel.setups, ...keys])] : sel.setups.filter((k) => !keys.includes(k)),
    });
  };
  const toggleSetup = (key: string, tier: (typeof TIERS)[number]['key'], on: boolean) =>
    onChange({ ...sel, tiers: on ? [...new Set([...sel.tiers, tier])] : sel.tiers, setups: on ? [...sel.setups, key] : sel.setups.filter((k) => k !== key) });
  const chosen = setups.filter((x) => sel.tiers.includes(x.s.tier) && sel.setups.includes(x.key)).length;
  return (
    <div className="space-y-3">
      {TIERS.filter((t) => setups.some((x) => x.s.tier === t.key)).map((t) => (
        <div key={t.key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <strong className="flex-1 text-xs">{t.label}</strong>
            <button type="button" onClick={() => toggleTier(t.key, true)} className="h-7 rounded border border-card-border px-2 text-xs text-gold">
              All
            </button>
            <button type="button" onClick={() => toggleTier(t.key, false)} className="h-7 rounded border border-card-border px-2 text-xs text-text-muted">
              None
            </button>
          </div>
          {setups
            .filter((x) => x.s.tier === t.key)
            .map(({ s, key }) => {
              const on = sel.tiers.includes(t.key) && sel.setups.includes(key);
              const tags = [s.accounts?.length ? s.accounts.map(accountLabel).join(', ') : 'All accounts', s.builds?.length ? s.builds.map(buildLabel).join(', ') : 'any build', s.pick ? 'Curator pick' : ''].filter(Boolean).join(' · ');
              return (
                <div key={key} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${on ? 'border-[#6b5326] bg-[#2a2114]' : 'border-card-border bg-black/20'}`}>
                  <Checkbox checked={on} onChange={(v) => toggleSetup(key, t.key, v)} ariaLabel={s.name} />
                  {s.gear.weapon ? <ItemSprite id={s.gear.weapon} size={26} /> : null}
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block truncate text-[13px]">{s.name}</span>
                    <span className="text-text-muted">{tags}</span>
                  </span>
                </div>
              );
            })}
        </div>
      ))}
      <Switch checked={sel.includeNew} onChange={(v) => onChange({ ...sel, includeNew: v })}>
        Also post setups added later
      </Switch>
      <p className="text-[11px] text-text-muted">
        {chosen} setup{chosen === 1 ? '' : 's'} selected · about {count} message{count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
