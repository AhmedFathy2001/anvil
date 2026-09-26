'use client';

import { useEffect, useMemo, useState } from 'react';

import { renderGuide } from '@/lib/guideMarkdown';
import { TIERS, parseGearBlock, splitSegments, tierOf, type TierKey } from '@/lib/guideTiers';
import GearProgression from '@/components/gear/GearProgression';

const PREF_KEY = 'anvil.guides.tier';

/**
 * A guide's body on the site: shared text always, each level's section behind a switcher, and a
 * live calculator wherever the guide has a gear block. Guides written without levels render as
 * plain text with no switcher.
 */
export default function GuideBody({ body, storageKey }: { body: string; storageKey: string }) {
  const segments = useMemo(() => splitSegments(body), [body]);
  const tiered = segments.some((s) => s.tier);
  const [tier, setTier] = useState<TierKey | 'all'>('all');

  // The reader's last choice, across guides — a beginner reading one guide is a beginner in the next.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (saved && (saved === 'all' || tierOf(saved))) setTier(saved as TierKey | 'all');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const choose = (t: TierKey | 'all') => {
    setTier(t);
    try {
      localStorage.setItem(PREF_KEY, t);
    } catch {
      /* storage unavailable */
    }
  };

  // Under "All levels", a level's section opens with its name — once, where the level begins.
  const opensLevel = segments.map((s, i) => !!s.tier && s.tier !== (i > 0 ? segments[i - 1].tier : null));
  return (
    <div>
      {tiered && (
        <div className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-1 bg-background/90 px-1 py-2 backdrop-blur" role="tablist" aria-label="Your level">
          <span className="mr-1 text-xs text-text-muted">Your level:</span>
          {TIERS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tier === t.key}
              onClick={() => choose(t.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tier === t.key ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
          <button
            role="tab"
            aria-selected={tier === 'all'}
            onClick={() => choose('all')}
            className={`rounded-full border px-3 py-1 text-xs ${tier === 'all' ? 'border-gold bg-gold/15 text-gold' : 'border-card-border text-text-muted hover:text-foreground'}`}
          >
            All levels
          </button>
        </div>
      )}
      {segments.map((seg, i) => {
        if (seg.tier && tier !== 'all' && seg.tier !== tier) return null;
        const header =
          seg.tier && tier === 'all' && opensLevel[i] ? (
            <div id={`tier-${seg.tier}`} className="mt-8 mb-2 flex scroll-mt-24 items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold/80">
              <span className="h-px flex-1 bg-gold/20" />
              {tierOf(seg.tier)?.emoji} {tierOf(seg.tier)?.label}
              <span className="h-px flex-1 bg-gold/20" />
            </div>
          ) : null;
        if (seg.kind === 'gear') {
          const block = parseGearBlock(seg.text);
          return (
            <div key={i}>
              {header}
              {block ? (
                <GearProgression block={block} tier={tier} storageKey={`${storageKey}:${block.monster}`} />
              ) : (
                <p className="text-sm text-amber-200">This gear block could not be read.</p>
              )}
            </div>
          );
        }
        return (
          <div key={i}>
            {header}
            {renderGuide(seg.text, { idPrefix: seg.tier ? `${seg.tier}-` : '' })}
          </div>
        );
      })}
    </div>
  );
}
