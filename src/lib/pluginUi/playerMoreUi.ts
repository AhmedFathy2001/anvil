import type { CaLookup } from '@/lib/combatTasks';
import { BOSSES, SKILLS } from '@/lib/constants';
import type { GoalView } from '@/lib/goalProgress';
import type { PlayerCard } from '@/lib/playerCardShape';

import { type Action, type Node, backRow, button, card, col, count, fmt, gap, header, icon, muted, percent, row, seg, text } from './nodes';
import { SKILL_GRID, backHeader, profilePath } from './playerCardUi';

// The rest of the player side of the panel: a log page's items, combat achievements, two players
// side by side, and goals (was PlayerCardView/PlayerCardCas/CompareView/GoalsView.java). Pure.

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---- A log page ---------------------------------------------------------------------------------

export interface ClogPageData {
  page: string;
  obtained: number;
  total: number;
  items: { id: number; name: string; owned: boolean; quantity: number }[];
}

/** The page's slots in the game's order: owned in full colour, the rest faint — as the log draws them. */
export function clogPageUi(rsn: string, p: ClogPageData, back: string, kc: number | null): Node {
  return col([
    backHeader(
      p.page,
      `${p.obtained}/${p.total}${kc ? ` · ${fmt(kc)} kc` : ''}`,
      p.total > 0 && p.obtained >= p.total,
      { a: 'pane', into: 'log', pane: back },
      `${profilePath(rsn)}?tab=collection&page=${seg(p.page)}`,
    ),
    gap(8),
    {
      t: 'grid',
      cols: 5,
      gap: 3,
      vgap: 3,
      c: p.items.map((i) =>
        icon({
          item: i.id,
          qty: i.owned && i.quantity > 1 ? i.quantity : undefined,
          dim: !i.owned,
          w: 36,
          h: 32,
          tip: i.owned && i.quantity > 1 ? `${i.name} × ${fmt(i.quantity)}` : i.owned ? i.name : `${i.name} — not yet`,
        }),
      ),
    },
  ]);
}

// ---- Combat achievements ------------------------------------------------------------------------

export interface CaFilters {
  /** Tier index, or -1 for every tier. */
  tier: number;
  /** List by task rather than by boss. */
  byTask: boolean;
  missingOnly: boolean;
}

const MAX_TASK_ROWS = 150;
const short = (tier: string) => tier.replace('Grandmaster', 'GM');

/**
 * Tier, points to the next one, each tier's count, then every boss with its tasks — unfinished bosses
 * first, a boss opening in place to its tasks, missing ones first. The switches reload this view.
 */
export function casUi(rsn: string, cas: CaLookup, f: CaFilters): Node {
  const reload = (next: Partial<CaFilters>): Action => {
    const n = { ...f, ...next };
    return {
      a: 'load',
      v: 'cas',
      args: { rsn, tier: String(n.tier), mode: n.byTask ? 'task' : 'boss', missing: n.missingOnly ? '1' : '' },
      into: 'cas',
    };
  };
  const tierName = (t: number) => cas.tiers[t] ?? '?';
  const next = cas.nextTier ? cas.tiers.indexOf(cas.nextTier) : cas.tiers.length;
  const reached = !cas.tiers.length ? '—' : next <= 0 ? 'No tier yet' : cas.tiers[next - 1];

  const parts: Node[] = [header(reached, `${fmt(cas.earned)} pts`)];
  if (cas.nextTier && cas.nextAt && cas.nextAt > 0) {
    parts.push(gap(4), { t: 'bar', pct: percent(cas.earned, cas.nextAt), color: 'brand', h: 6, bg: 'card' });
    parts.push(gap(2), muted(`${fmt(cas.earned)} / ${fmt(cas.nextAt)} to ${cas.nextTier}`));
  }
  parts.push(gap(6), {
    t: 'grid',
    cols: 2,
    gap: 6,
    vgap: 4,
    c: cas.perTier.map((c, t) =>
      col([row(text(short(tierName(t)), f.tier === t ? 'brand' : 'muted'), undefined, text(`${c.done}/${c.total}`), { gap: 0 }), gap(2), { t: 'bar', pct: percent(c.done, c.total), h: 3, bg: 'card' }], {
        inset: 3,
        bg: f.tier === t ? 'card' : 'panel',
        tip: `Show only ${tierName(t)} tasks`,
        on: reload({ tier: f.tier === t ? -1 : t }),
      }),
    ),
  });

  const shows = (task: { d: boolean; t: number }) => (!f.missingOnly || !task.d) && (f.tier < 0 || task.t === f.tier);
  const taskRow = (task: CaLookup['monsters'][number]['tasks'][number], boss: string | null): Node =>
    row(undefined, text(`${task.d ? '✓' : '✗'} ${task.n}`, task.d ? 'done' : 'white'), muted(short(tierName(task.t))), {
      bg: 'card',
      pad: 2,
      inset: boss != null ? 4 : 12,
      tip: `${boss != null ? `${boss}: ` : ''}${task.n} — ${tierName(task.t)}${task.y ? ` · ${task.y}` : ''}${task.x ? `\n${task.x}` : ''}`,
      k: `${task.n} ${task.x ?? ''} ${boss ?? ''}`,
    });

  const rows: Node[] = [];
  for (const m of cas.monsters) {
    if (f.byTask) {
      for (const task of m.tasks) if (shows(task)) rows.push(taskRow(task, m.name));
      continue;
    }
    // With a tier picked, a boss counts only that tier's tasks — and drops out without any.
    const inTier = m.tasks.filter((t) => f.tier < 0 || t.t === f.tier);
    const shown = inTier.filter(shows);
    if (!shown.length) continue;
    const done = inTier.filter((t) => t.d).length;
    const complete = done >= inTier.length;
    rows.push({
      t: 'fold',
      k: m.name,
      chev: !complete,
      head: row(undefined, text(m.name, complete ? 'muted' : 'white'), text(`${done}/${inTier.length}${complete ? ' ✓' : ''}`, complete ? 'done' : 'brand'), { pad: 3 }),
      c: col(shown.map((t) => taskRow(t, null))),
    });
  }

  const total = cas.monsters.reduce((s, m) => s + m.total, 0);
  parts.push(
    gap(8),
    row(
      row(text('Bosses', f.byTask ? 'muted' : 'brand', { on: reload({ byTask: false }) }), muted('  ·  '), text('Tasks', f.byTask ? 'brand' : 'muted', { on: reload({ byTask: true }) }), { gap: 0 }),
      undefined,
      text(`${f.missingOnly ? '✓ ' : ''}Missing only`, f.missingOnly ? 'brand' : 'muted', { on: reload({ missingOnly: !f.missingOnly }) }),
    ),
    gap(4),
    { t: 'filter', hint: `Search ${fmt(total)} tasks…`, box: total >= 10, none: 'Nothing matches.', max: MAX_TASK_ROWS, more: 'More — narrow the search.', c: [col(rows)] },
  );
  return col(parts);
}

// ---- Two players side by side -----------------------------------------------------------------

/** "Label    a    b" with the bigger of the two in orange. Negative = unknown, never leads. */
export function vsRow(label: string, a: number, b: number, fmtN: (n: number) => string = fmt): Node {
  const f = (n: number) => (n < 0 ? '—' : fmtN(n));
  return {
    t: 'grid',
    cols: 3,
    gap: 6,
    c: [muted(label), text(f(a), a >= 0 && a > b ? 'brand' : 'white', { align: 'r' }), text(f(b), b >= 0 && b > a ? 'brand' : 'white', { align: 'r' })],
  };
}

export const namesRow = (a: string, b: string): Node => ({ t: 'grid', cols: 3, gap: 6, c: [text(''), text(a, 'white', { align: 'r' }), text(b, 'white', { align: 'r' })] });

const nz = (n: number | null | undefined) => (n == null ? -1 : n);

/**
 * You and whoever you looked up: a line per headline number with the leader's in orange, then where
 * each of you is ahead — skills by the size of the gap, the bosses either of you kills most, and the
 * log pages where your counts differ.
 */
export function compareUi(me: PlayerCard, them: PlayerCard): Node {
  const parts: Node[] = [
    backRow(`Back to ${them.rsn}`, { a: 'load', v: 'player', args: { rsn: them.rsn } }),
    card([
      namesRow('You', them.rsn),
      gap(4),
      vsRow('Total level', me.totalLevel, them.totalLevel),
      vsRow('Combat', nz(me.combatLevel), nz(them.combatLevel), String),
      vsRow('Total XP', nz(me.overallXp), nz(them.overallXp), count),
      vsRow('EHP', Math.round(me.ehp ?? 0), Math.round(them.ehp ?? 0), (n) => `${n}h`),
      vsRow('EHB', Math.round(me.ehb ?? 0), Math.round(them.ehb ?? 0), (n) => `${n}h`),
      vsRow('Log slots', me.clog?.obtained ?? -1, them.clog?.obtained ?? -1),
    ]),
  ];

  const lv = (c: PlayerCard) => new Map(c.skills.map((s) => [s.key.toLowerCase(), s.level]));
  const a = lv(me);
  const b = lv(them);
  if (a.size || b.size) {
    const diffs = SKILL_GRID.map((k) => ({ k, mine: a.get(k) ?? 1, theirs: b.get(k) ?? 1 })).sort(
      (x, y) => Math.abs(y.mine - y.theirs) - Math.abs(x.mine - x.theirs),
    );
    const ahead = diffs.filter((d) => d.mine > d.theirs).length;
    const behind = diffs.filter((d) => d.theirs > d.mine).length;
    parts.push(
      gap(6),
      card([
        header('Skills', `you lead ${ahead} · they lead ${behind}`),
        gap(4),
        {
          t: 'grid',
          cols: 2,
          gap: 6,
          vgap: 2,
          c: diffs.map((d) =>
            text(`${d.mine} / ${d.theirs}`, d.mine > d.theirs ? 'done' : d.theirs > d.mine ? 'error' : 'muted', {
              icon: icon({ skill: d.k, alt: cap(d.k).slice(0, 3) }),
              tip: `${cap(d.k)} — you ${d.mine}, them ${d.theirs}`,
            }),
          ),
        },
      ]),
    );
  }

  // The ten bosses either of you has killed most, with both counts.
  const kc = new Map<string, [number, number, string]>();
  [me, them].forEach((c, side) => {
    for (const boss of c.bosses) {
      const e = kc.get(boss.key) ?? [0, 0, boss.label];
      e[side] = boss.kc;
      kc.set(boss.key, e);
    }
  });
  const bosses = [...kc.entries()].sort((x, y) => Math.max(y[1][0], y[1][1]) - Math.max(x[1][0], x[1][1])).slice(0, 10);
  if (bosses.length) {
    parts.push(
      gap(6),
      card([
        header('Bosses', 'you / them'),
        gap(4),
        ...bosses.map(([key, [m, t, label]]) => row(icon({ boss: key, w: 22, h: 20 }), vsRow(label, m, t), undefined)),
      ]),
    );
  }

  // Log pages where your counts differ, biggest gap first, at most eight.
  const pages = new Map<string, [number, number]>();
  [me, them].forEach((c, side) => {
    for (const p of c.clogPages) {
      const e = pages.get(p.name) ?? [0, 0];
      e[side] = p.obtained;
      pages.set(p.name, e);
    }
  });
  const diffPages = [...pages.entries()]
    .filter(([, [x, y]]) => x !== y)
    .sort((x, y) => Math.abs(y[1][0] - y[1][1]) - Math.abs(x[1][0] - x[1][1]))
    .slice(0, 8);
  if (diffPages.length) {
    parts.push(gap(6), card([header('Collection log', 'pages that differ'), gap(4), ...diffPages.map(([name, [x, y]]) => vsRow(name, x, y, String))]));
  }
  // The panel shows the headline and the biggest gaps; the page has every skill, boss and page.
  parts.push(
    gap(6),
    button('Full comparison on the site ↗', { a: 'site', path: `/compare?a=${seg(me.rsn)}&b=${seg(them.rsn)}` }, 'Every skill, boss and log page side by side'),
  );
  return col(parts);
}

// ---- Goals --------------------------------------------------------------------------------------

/** The You tab's goals: "99 Slayer", "500 Vorkath", "Barrows log complete". Lives in slot `goals`. */
export function goalsUi(goals: GoalView[], error: string | null): Node {
  const parts: Node[] = [
    row(text('Goals', 'brand'), undefined, text('+ Add goal', 'brand', {
      tip: 'A skill level, a boss kill count, or a whole log page',
      on: { a: 'load', v: 'goal-new', into: 'goals' },
    }), { gap: 0 }),
  ];
  if (error) parts.push(gap(4), text(error, 'error', { wrap: true }));
  if (!goals.length) {
    parts.push(gap(6), muted('Nothing set yet — 99 a skill, a KC to hit, a log page to finish.', { wrap: true }));
  }
  for (const g of goals) {
    const due = g.done ? null : g.due;
    parts.push(
      gap(8),
      row(
        icon({ glyph: 'close', w: 8, h: 8, color: 'muted', tip: 'Remove this goal', on: { a: 'post', act: 'goal-remove', args: { id: String(g.id) }, into: 'goals' } }),
        text(g.label, g.done ? 'done' : 'white'),
        text(g.done ? 'Done' : g.text, g.done ? 'done' : 'muted'),
      ),
    );
    if (due) parts.push(text(due.text, due.tone === 'overdue' ? 'error' : 'muted'));
    if (g.current != null) {
      parts.push(gap(3), { t: 'bar', pct: percent(Math.min(g.current, g.of), Math.max(1, g.of)), color: g.done ? 'done' : 'brand', h: 4, bg: 'panel' });
    }
  }
  return { t: 'slot', id: 'goals', c: card(parts) };
}

const KINDS = [
  { v: 'skill', label: 'Skill level' },
  { v: 'boss', label: 'Boss kills' },
  { v: 'clog', label: 'Log page' },
];

const DEADLINES = [
  { v: '', label: 'No deadline' },
  { v: '7', label: 'In a week' },
  { v: '14', label: 'In two weeks' },
  { v: '30', label: 'In a month' },
  { v: '90', label: 'In three months' },
  { v: '180', label: 'In six months' },
  { v: '365', label: 'In a year' },
];

/** The new-goal form, in place of the goals list. Log pages are offered once the log is synced. */
export function goalFormUi(kind: string, pages: string[]): Node {
  const k = KINDS.some((x) => x.v === kind) && (kind !== 'clog' || pages.length) ? kind : 'skill';
  const kinds = KINDS.filter((x) => x.v !== 'clog' || pages.length);
  const what =
    k === 'skill'
      ? SKILLS.filter((s) => s !== 'overall').map((s) => ({ v: s, label: cap(s) }))
      : k === 'boss'
        ? [...BOSSES].sort((x, y) => x.label.localeCompare(y.label)).map((b) => ({ v: b.key, label: b.label }))
        : pages.map((p) => ({ v: p, label: p }));
  const parts: Node[] = [
    header('New goal'),
    gap(6),
    row(
      undefined,
      {
        t: 'grid',
        cols: kinds.length,
        gap: 4,
        c: kinds.map((x) => text(x.label, x.v === k ? 'brand' : 'muted', { align: 'c', on: { a: 'load', v: 'goal-new', args: { kind: x.v }, into: 'goals' } })),
      },
      undefined,
    ),
    gap(6),
    { t: 'input', name: 'metric', kind: 'select', options: what, value: what[0]?.v },
  ];
  if (k === 'skill') parts.push(gap(4), { t: 'input', name: 'target', kind: 'number', label: 'Level', value: '99', min: 2, max: 99, step: 1 });
  if (k === 'boss') parts.push(gap(4), { t: 'input', name: 'target', kind: 'number', label: 'Kill count', value: '100', min: 1, max: 100_000, step: 50 });
  parts.push(
    gap(4),
    { t: 'input', name: 'due', kind: 'select', options: DEADLINES, value: '' },
    gap(8),
    row(
      undefined,
      { t: 'grid', cols: 2, gap: 6, c: [button('Cancel', { a: 'load', v: 'goals', into: 'goals' }), button('Add goal', { a: 'post', act: 'goal-add', args: { kind: k }, into: 'goals' })] },
      undefined,
    ),
  );
  return { t: 'slot', id: 'goals', c: card(parts) };
}

/** The deadline the form's "In a month" means, as the goal stores it. */
export function dueOnFrom(days: string, now: Date = new Date()): string | null {
  const n = Number(days);
  if (!days || !Number.isInteger(n) || n <= 0) return null;
  return new Date(now.getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
