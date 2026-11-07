'use client';

import { useState } from 'react';
import { setUrlParams } from '@/lib/urlState';
import { GUIDE_TAB_PARAM, guideTabParam, type GuideTab } from '../_i18n/guideTabs';

/**
 * "Using Anvil" | "In-game guides" on /guide.
 *
 * Same look as the other tab rows on the site (members, profile). Both panels are rendered on the
 * server and the inactive one is only hidden, so switching is instant and a crawler reading
 * `/guide` sees both lists. The tab is written into the address (`?tab=ingame`) so a link to the
 * in-game list can be shared.
 */
export default function GuideTabs({
  initial,
  labels,
  anvil,
  ingame,
}: {
  initial: GuideTab;
  labels: Record<GuideTab, string>;
  anvil: React.ReactNode;
  ingame: React.ReactNode;
}) {
  const [tab, setTab] = useState<GuideTab>(initial);
  const tabs: GuideTab[] = ['anvil', 'ingame'];

  const pick = (next: GuideTab) => {
    setTab(next);
    setUrlParams({ [GUIDE_TAB_PARAM]: guideTabParam(next) });
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-card-border" role="tablist">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`guide-tab-${key}`}
            aria-controls={`guide-panel-${key}`}
            aria-selected={tab === key}
            onClick={() => pick(key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === key
                ? 'border-gold font-medium text-gold'
                : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="guide-panel-anvil" aria-labelledby="guide-tab-anvil" hidden={tab !== 'anvil'}>
        {anvil}
      </div>
      <div role="tabpanel" id="guide-panel-ingame" aria-labelledby="guide-tab-ingame" hidden={tab !== 'ingame'}>
        {ingame}
      </div>
    </>
  );
}
