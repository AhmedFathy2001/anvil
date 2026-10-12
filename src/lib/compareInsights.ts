import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import type { PlayerCard } from '@/lib/playerCardShape';
import type { PlayerComparison } from '@/lib/compare';
import { XP_TABLE } from '@/lib/xp';

// The comparison in sentences: what the two tables say when you read them together. Pure
// (tests/pure-module-imports) — every number comes off the two cards and the comparison already built.

export type Side = 'a' | 'b';

/** A sentence in parts, so the page can colour each player's name in their side's colour. */
export type InsightPart = string | { side: Side };

export interface Insight {
  key: string;
  parts: InsightPart[];
  /** Whose point it is, for the marker beside it; null for an even one. */
  lead: Side | null;
}

const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label]));
const skillName = (k: string) => SKILL_LABELS[k] ?? k;

function hours(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')}h`;
}

function xp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

function pct(a: number, b: number): number {
  return b > 0 ? Math.round(((a - b) / b) * 100) : 0;
}

/** Bossing's share of a player's efficient hours, and what that makes them. */
function style(c: PlayerCard): { share: number; label: string } | null {
  const ehp = c.ehp ?? 0;
  const ehb = c.ehb ?? 0;
  if (ehp + ehb <= 0) return null;
  const share = ehb / (ehp + ehb);
  return { share, label: share >= 0.5 ? 'a bosser' : share >= 0.25 ? 'an all-rounder' : 'a skiller' };
}

export function compareInsights(
  a: PlayerCard,
  b: PlayerCard,
  cmp: PlayerComparison,
  /** EHP + EHB gained over the last 7 days, when there's history. */
  week?: { a: number | null; b: number | null },
): Insight[] {
  const out: Insight[] = [];
  const A = { side: 'a' as const };
  const B = { side: 'b' as const };

  // ── Playstyle ────────────────────────────────────────────────────────────────────────────────
  const sa = style(a);
  const sb = style(b);
  if (sa && sb) {
    out.push({
      key: 'style',
      lead: null,
      parts:
        sa.label === sb.label
          ? [A, ' and ', B, ` are both ${sa.label.replace(/^an? /, '')}s — bossing is ${Math.round(sa.share * 100)}% and ${Math.round(sb.share * 100)}% of their hours.`]
          : [A, ` is ${sa.label} (${Math.round(sa.share * 100)}% of their hours are kills); `, B, ` is ${sb.label} at ${Math.round(sb.share * 100)}%.`],
    });
  }

  // ── Time invested ────────────────────────────────────────────────────────────────────────────
  const ta = (a.ehp ?? 0) + (a.ehb ?? 0);
  const tb = (b.ehp ?? 0) + (b.ehb ?? 0);
  if (ta > 0 && tb > 0 && Math.abs(ta - tb) / Math.max(ta, tb) >= 0.05) {
    const lead: Side = ta > tb ? 'a' : 'b';
    const [hi, lo] = lead === 'a' ? [ta, tb] : [tb, ta];
    out.push({
      key: 'time',
      lead,
      parts: [lead === 'a' ? A : B, ` has put in ${hours(hi)} of efficient play — ${pct(hi, lo)}% more than `, lead === 'a' ? B : A, ` (${hours(lo)}).`],
    });
  }

  // ── Biggest skill gap, and the closest race ──────────────────────────────────────────────────
  const skills = cmp.skills.filter((s) => s.levelA != null && s.levelB != null && s.xpA != null && s.xpB != null);
  const widest = [...skills].sort((x, y) => Math.abs(y.levelA! - y.levelB!) - Math.abs(x.levelA! - x.levelB!))[0];
  if (widest && widest.levelA !== widest.levelB) {
    const lead: Side = widest.levelA! > widest.levelB! ? 'a' : 'b';
    const gapXp = Math.abs(widest.xpA! - widest.xpB!);
    out.push({
      key: 'gap',
      lead,
      parts: [
        `Biggest gap: ${skillName(widest.key)} — `,
        lead === 'a' ? A : B,
        ` is ${Math.abs(widest.levelA! - widest.levelB!)} levels ahead (${widest.levelA} vs ${widest.levelB}), about ${xp(gapXp)} XP to close.`,
      ],
    });
  }
  const close = skills
    .filter((s) => s.levelA !== s.levelB && Math.max(s.levelA!, s.levelB!) < 99)
    .sort((x, y) => Math.abs(x.xpA! - x.xpB!) - Math.abs(y.xpA! - y.xpB!))[0];
  if (close) {
    const behind: Side = close.xpA! < close.xpB! ? 'a' : 'b';
    const target = behind === 'a' ? close.levelB! : close.levelA!;
    const have = behind === 'a' ? close.xpA! : close.xpB!;
    out.push({
      key: 'close',
      lead: null,
      parts: [
        `Closest race: ${skillName(close.key)}, ${close.levelA} vs ${close.levelB} — `,
        behind === 'a' ? A : B,
        ` is ${xp(Math.max(0, (XP_TABLE[target] ?? 0) - have))} XP from drawing level.`,
      ],
    });
  }

  // ── Signature bosses: where each one most outkills the other ──────────────────────────────────
  for (const side of ['a', 'b'] as const) {
    const best = cmp.bosses
      .filter((x) => x.kcA != null && x.kcB != null)
      .map((x) => {
        const mine = side === 'a' ? x.kcA! : x.kcB!;
        const theirs = side === 'a' ? x.kcB! : x.kcA!;
        return { x, mine, theirs, edge: mine >= 50 ? mine / Math.max(theirs, 1) : 0 };
      })
      .filter((r) => r.edge >= 3)
      .sort((p, q) => q.edge - p.edge)[0];
    if (best) {
      out.push({
        key: `boss-${side}`,
        lead: side,
        parts: [side === 'a' ? A : B, `'s signature: ${bossLabel.get(best.x.key) ?? best.x.label} — ${best.mine.toLocaleString('en-US')} kills to ${best.theirs.toLocaleString('en-US')}.`],
      });
    }
  }

  // ── The log: who leads, and where most of it comes from ───────────────────────────────────────
  if (a.clog && b.clog && a.clog.obtained !== b.clog.obtained) {
    const lead: Side = a.clog.obtained > b.clog.obtained ? 'a' : 'b';
    const ga = new Map(a.clog.groups.map((g) => [g.name, g.obtained]));
    const gb = new Map(b.clog.groups.map((g) => [g.name, g.obtained]));
    const names = new Set([...ga.keys(), ...gb.keys()]);
    let where = '';
    let most = 0;
    for (const n of names) {
      const d = lead === 'a' ? (ga.get(n) ?? 0) - (gb.get(n) ?? 0) : (gb.get(n) ?? 0) - (ga.get(n) ?? 0);
      if (d > most) {
        most = d;
        where = n;
      }
    }
    const diff = Math.abs(a.clog.obtained - b.clog.obtained);
    out.push({
      key: 'log',
      lead,
      parts: [
        lead === 'a' ? A : B,
        ` leads the collection log by ${diff.toLocaleString('en-US')} slots${where && most > 0 ? ` — ${most.toLocaleString('en-US')} of them in ${where}` : ''}.`,
      ],
    });
  }

  // ── This week ────────────────────────────────────────────────────────────────────────────────
  if (week && week.a != null && week.b != null && (week.a > 0 || week.b > 0)) {
    const lead: Side | null = week.a === week.b ? null : week.a > week.b ? 'a' : 'b';
    out.push({
      key: 'week',
      lead,
      parts: ['This week: ', A, ` gained ${week.a.toFixed(1)}h, `, B, ` ${week.b.toFixed(1)}h.`],
    });
  }

  return out;
}
