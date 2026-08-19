'use client';

import { useMemo, useState } from 'react';
import type { ProgressSummary } from '@/lib/memberProgress';
import { filterItems, itemGroups, type ItemFilter, type ProgressItem } from '@/lib/memberProgressItems';
import {
  CA_TIERS,
  combatTasks,
  filterTasks,
  taskMonsters,
  taskPoints,
  taskTypes,
} from '@/lib/combatTasks';
import { PANEL, RS_ORANGE, RS_STATE, RS_TEXT, TAB, TAB_ON, WELL } from '@/components/gameChrome';
import Combobox from '@/components/Combobox';

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

/** One of the interface's dropdowns: a label above a select, in the game's chrome. */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-xs mb-1" style={{ color: RS_ORANGE }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${WELL} w-full px-2 py-1 text-xs outline-none`}
        style={{ color: RS_TEXT }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: '#2b2620' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CombatTab({ summary, tasks }: { summary: ProgressSummary; tasks: ProgressItem[] | null }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [type, setType] = useState('all');
  const [monster, setMonster] = useState('all');
  const [completed, setCompleted] = useState<'all' | 'done' | 'todo'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const all = useMemo(() => combatTasks(tasks), [tasks]);
  const monsters = useMemo(() => taskMonsters(all), [all]);
  const types = useMemo(() => taskTypes(all), [all]);
  const points = useMemo(() => taskPoints(all), [all]);
  const shown = useMemo(
    () => filterTasks(all, {
      search,
      tier: tier === 'all' ? null : tier,
      type: type === 'all' ? null : type,
      monster: monster === 'all' ? null : monster,
      completed,
    }),
    [all, search, tier, type, monster, completed],
  );

  // Without a task list from the plugin we know the totals but not which tasks — so say that,
  // rather than drawing six hundred rows as though every one of them were unfinished.
  const known = tasks != null && tasks.length > 0;
  const earned = known ? points.earned : summary.caPoints ?? 0;
  const barPct = points.total > 0 ? Math.min(100, Math.round((earned / points.total) * 100)) : 0;

  return (
    <div>
      {/* The points bar the interface opens with. */}
      <div className={`${WELL} relative h-6 mb-3 overflow-hidden`}>
        <div
          className="absolute inset-y-0 left-0 bg-[#1f7a1f]"
          style={{ width: `${barPct}%` }}
          aria-hidden
        />
        <p className="relative text-center text-xs leading-6 font-semibold" style={{ color: RS_TEXT }}>
          Total Points: {earned.toLocaleString()}
          {known && points.nextAt != null
            ? ` — Next unlock in ${(points.nextAt - earned).toLocaleString()} points`
            : ''}
        </p>
      </div>

      {!known ? (
        <div className={`${WELL} p-4 text-center text-xs`} style={{ color: RS_TEXT }}>
          <p className="mb-2">
            Your plugin hasn&apos;t sent the task list yet, so this shows the totals only.
          </p>
          <p className="opacity-70">
            {summary.caTier === '—' ? 'No tier cleared yet.' : `Highest tier cleared: ${summary.caTier}.`}
          </p>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Filters column, as the game lays it out. */}
          <div className={`${PANEL} p-2 w-40 shrink-0 hidden sm:block`}>
            <p className="text-center text-xs font-bold mb-2" style={{ color: RS_ORANGE }}>Filters</p>
            <FilterSelect
              label="Tier"
              value={tier}
              onChange={setTier}
              options={[{ value: 'all', label: 'All' }, ...CA_TIERS.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Type"
              value={type}
              onChange={setType}
              options={[{ value: 'all', label: 'All' }, ...types.map((t) => ({ value: t, label: t }))]}
            />
            {/* The game gives you a dropdown of every monster in it, which is the worst part of the
                interface: finding "Phosani's Nightmare" means scrolling past two hundred others.
                Type instead — an exact match filters, anything else means no filter. */}
            <label className="block mb-3">
              <span className="block text-xs mb-1" style={{ color: RS_ORANGE }}>Monster:</span>
              <Combobox
                value={monster === 'all' ? '' : monster}
                onChange={(v) => setMonster(v.trim() === '' ? 'all' : v)}
                suggestions={monsters}
                placeholder="Any monster"
                ariaLabel="Filter by monster"
              />
            </label>
            <FilterSelect
              label="Completed"
              value={completed}
              onChange={(v) => setCompleted(v as 'all' | 'done' | 'todo')}
              options={[
                { value: 'all', label: 'All' },
                { value: 'done', label: 'Completed' },
                { value: 'todo', label: 'Not completed' },
              ]}
            />
          </div>

          <div className="min-w-0 flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search combat tasks"
              className={`${WELL} w-full px-2 py-1 text-xs outline-none mb-2`}
              style={{ color: RS_TEXT }}
            />
            <div className={`${WELL} max-h-96 overflow-y-auto`}>
              {shown.length === 0 ? (
                <p className="px-2 py-3 text-xs text-center" style={{ color: RS_TEXT }}>Nothing matches that.</p>
              ) : (
                <ul>
                  {shown.map((task) => {
                    const key = `${task.tier}-${task.name}`;
                    const open = expanded === key;
                    return (
                      <li key={key} className="odd:bg-black/10">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : key)}
                          aria-expanded={open}
                          className="w-full text-left px-2 py-1 hover:bg-black/20"
                        >
                          <p className="text-[13px] leading-tight" style={{ color: task.done ? RS_STATE[2] : '#8f8779' }}>
                            {task.name}
                          </p>
                          <p className="text-[11px] leading-tight" style={{ color: RS_ORANGE, opacity: task.done ? 1 : 0.6 }}>
                            {task.monster ? `Monster: ${task.monster}` : task.tier}
                            <span className="opacity-70"> · {task.tier}</span>
                            {task.type && <span className="opacity-70"> · {task.type}</span>}
                          </p>
                        </button>
                        {/* What the task actually asks for — the game shows it on hover, which is
                            no use on a phone and no use at all if you want to read two of them. */}
                        {open && (
                          <p className="px-2 pb-2 text-[12px] leading-snug" style={{ color: RS_TEXT }}>
                            {task.description ?? 'No description in the catalogue for this one.'}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: RS_TEXT }}>
              {shown.filter((t) => t.done).length} of {shown.length} shown complete
              {shown.length !== all.length && ` · ${all.length} tasks in total`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountProgressCard({
  summary,
  title = 'Account progress',
  quests = null,
  combat = null,
}: {
  summary: ProgressSummary;
  title?: string;
  quests?: { items: ProgressItem[]; done: number; total: number } | null;
  /** Completed combat tasks as the plugin read them; the catalogue is joined on the site. */
  combat?: { items: ProgressItem[] } | null;
}) {
  const hasDiaries = summary.diariesKnowable > 0;
  const hasCombat = summary.caPoints != null || (combat?.items?.length ?? 0) > 0;
  const tabs: { key: Tab; label: string }[] = [
    ...(quests ? [{ key: 'quests' as Tab, label: 'Quests' }] : []),
    ...(hasDiaries ? [{ key: 'diaries' as Tab, label: 'Diaries' }] : []),
    ...(hasCombat ? [{ key: 'combat' as Tab, label: 'Combat' }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? 'quests');

  if (summary.empty && !quests && !combat) return null;
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
        {active === 'combat' && <CombatTab summary={summary} tasks={combat?.items ?? null} />}
      </div>
    </section>
  );
}
