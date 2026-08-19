'use client';

import { useMemo, useState } from 'react';
import type { ProgressSummary } from '@/lib/memberProgress';
import { filterItems, itemGroups, type ItemFilter, type ProgressItem } from '@/lib/memberProgressItems';
import { PANEL, RS_ORANGE, RS_STATE, RS_TEXT, TAB, TAB_ON, WELL } from '@/components/gameChrome';

/**
 * Quests, diaries and combat achievements, drawn the way the game draws them.
 *
 * The player has read these three interfaces a thousand times: a beveled brown panel, tabs along the
 * top, a recessed list, and names in red / yellow / green. Reproducing that costs nothing and means
 * nobody has to learn what this page is telling them — whereas a tidy web card in the same colours
 * is a thing they have to read twice.
 *
 * Data comes from lib/memberProgress (counters) and lib/memberProgressItems (the lists). Anything
 * the plugin hasn't sent is simply absent: a tab with nothing behind it doesn't render.
 */

type Tab = 'quests' | 'diaries' | 'combat';

const FILTERS: { key: ItemFilter; label: string }[] = [
  { key: 'todo', label: 'Not complete' },
  { key: 'started', label: 'Started' },
  { key: 'done', label: 'Complete' },
  { key: 'all', label: 'All' },
];

const STATE_LABEL: Record<number, string> = { 0: 'Not started', 1: 'Started', 2: 'Complete' };

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold tracking-wide ${active ? TAB_ON : TAB} hover:text-[#ff981f] transition-colors`}
    >
      {children}
    </button>
  );
}

/** The centred heading every one of these interfaces puts above its list. */
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-sm font-bold mb-2" style={{ color: RS_ORANGE }}>
      {children}
    </p>
  );
}

function QuestTab({ quests, questPoints }: { quests: { items: ProgressItem[]; done: number; total: number }; questPoints: number | null }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [group, setGroup] = useState<string | null>(null);

  const groups = useMemo(() => itemGroups(quests.items), [quests.items]);
  const shown = useMemo(
    () => filterItems(quests.items, { search, filter, group }),
    [quests.items, search, filter, group],
  );

  return (
    <div>
      <Heading>Quest Points: {questPoints != null ? questPoints.toLocaleString() : quests.done}</Heading>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search quests"
          className={`${WELL} flex-1 min-w-[8rem] px-2 py-1 text-xs outline-none`}
          style={{ color: RS_TEXT }}
        />
        {FILTERS.map((f) => (
          <TabButton key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </TabButton>
        ))}
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <TabButton active={group === null} onClick={() => setGroup(null)}>All</TabButton>
          {groups.map((g) => (
            <TabButton key={g} active={group === g} onClick={() => setGroup(g === group ? null : g)}>
              {g}
            </TabButton>
          ))}
        </div>
      )}

      <div className={`${WELL} max-h-80 overflow-y-auto py-1`}>
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-xs text-center" style={{ color: RS_TEXT }}>Nothing matches that.</p>
        ) : (
          <ul>
            {shown.map((item) => (
              <li
                key={item.id}
                title={`${item.name} — ${STATE_LABEL[item.state]}`}
                className="flex items-baseline gap-2 px-2 py-[2px] text-[13px] hover:bg-black/20"
              >
                <span style={{ color: RS_STATE[item.state] }}>{item.name}</span>
                {item.group && (
                  <span className="ml-auto text-[10px] shrink-0 opacity-60" style={{ color: RS_TEXT }}>
                    {item.group}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 text-[11px] flex flex-wrap gap-3" style={{ color: RS_TEXT }}>
        <span>{quests.done} of {quests.total} complete</span>
        {[0, 1, 2].map((state) => (
          <span key={state} className="flex items-center gap-1">
            <span className="w-2 h-2" style={{ backgroundColor: RS_STATE[state] }} aria-hidden />
            {STATE_LABEL[state]}
          </span>
        ))}
      </p>
    </div>
  );
}

function DiaryTab({ summary }: { summary: ProgressSummary }) {
  const { regions, diariesDone, diariesKnowable } = summary;
  const anyUnknown = regions.some((r) => r.tiers.some((t) => t.state === 'unknown'));

  return (
    <div>
      <Heading>Achievement Diaries: {diariesDone} / {diariesKnowable}</Heading>

      {regions.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: RS_TEXT }}>
          Your plugin hasn&apos;t sent the region breakdown yet — the totals above are what it knows.
        </p>
      ) : (
        <div className={`${WELL} py-1`}>
          {regions.map((region) => (
            <div key={region.key} className="flex items-center gap-2 px-2 py-[3px] text-[13px] hover:bg-black/20">
              <span className="flex-1 min-w-0 truncate" style={{ color: RS_TEXT }}>{region.label}</span>
              {/* Tier by tier, named rather than initialled: the game writes them out, and four
                  letters in a row is a puzzle where four words are a sentence. */}
              {region.tiers.map((tier) => (
                <span
                  key={tier.label}
                  title={`${tier.label} — ${tier.state === 'unknown' ? 'not readable' : tier.state === 'done' ? 'complete' : 'not complete'}`}
                  className="text-[11px] w-14 text-center shrink-0"
                  style={{
                    color: tier.state === 'done' ? RS_STATE[2] : tier.state === 'todo' ? RS_STATE[0] : '#7a7266',
                  }}
                >
                  {tier.state === 'unknown' ? '—' : tier.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {anyUnknown && (
        <p className="mt-2 text-[11px] opacity-70" style={{ color: RS_TEXT }}>
          Karamja&apos;s easy, medium and hard tiers have no completion flag in the game, so they read
          as unknown rather than as unfinished.
        </p>
      )}
    </div>
  );
}

function CombatTab({ summary }: { summary: ProgressSummary }) {
  const { caPoints, caTiers, caTier } = summary;
  return (
    <div>
      <Heading>Combat Achievements: {(caPoints ?? 0).toLocaleString()} points</Heading>
      <div className={`${WELL} py-1`}>
        {caTiers.map((tier) => (
          <div key={tier.name} className="flex items-center gap-2 px-2 py-[3px] text-[13px] hover:bg-black/20">
            <span className="flex-1" style={{ color: RS_TEXT }}>{tier.name}</span>
            <span style={{ color: tier.cleared ? RS_STATE[2] : RS_STATE[0] }}>
              {tier.cleared ? 'Complete' : 'Incomplete'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: RS_TEXT }}>
        Highest tier cleared: <span style={{ color: RS_ORANGE }}>{caTier}</span>
      </p>
    </div>
  );
}

export default function AccountProgressCard({
  summary,
  title = 'Account progress',
  quests = null,
}: {
  summary: ProgressSummary;
  title?: string;
  quests?: { items: ProgressItem[]; done: number; total: number } | null;
}) {
  const hasDiaries = summary.diariesKnowable > 0;
  const hasCombat = summary.caPoints != null;
  const tabs: { key: Tab; label: string }[] = [
    ...(quests ? [{ key: 'quests' as Tab, label: 'Quests' }] : []),
    ...(hasDiaries ? [{ key: 'diaries' as Tab, label: 'Diaries' }] : []),
    ...(hasCombat ? [{ key: 'combat' as Tab, label: 'Combat' }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? 'quests');

  if (summary.empty && !quests) return null;
  if (tabs.length === 0) return null;
  const active = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="font-semibold">{title}</h2>
        <span className="text-[11px] text-text-muted ml-auto">the numbers the hiscores don&apos;t carry</span>
      </div>

      <div className={`${PANEL} p-3`}>
        <div className="flex flex-wrap gap-1 mb-3">
          {tabs.map((t) => (
            <TabButton key={t.key} active={active === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </TabButton>
          ))}
          <span className="ml-auto text-[11px] self-center" style={{ color: RS_ORANGE }}>
            {summary.questPoints != null && `${summary.questPoints.toLocaleString()} QP`}
          </span>
        </div>

        {active === 'quests' && quests && <QuestTab quests={quests} questPoints={summary.questPoints} />}
        {active === 'diaries' && <DiaryTab summary={summary} />}
        {active === 'combat' && <CombatTab summary={summary} />}
      </div>
    </section>
  );
}
