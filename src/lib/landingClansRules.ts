// Pure rules for what the signed-out landing shows as proof of use. No database import, so a test
// can run them (lib/landingClans does the reading).

export interface ShowcaseClan {
  slug: string;
  name: string;
  kind?: string;
  logoUrl?: string | null;
  members: number;
  activeThisWeek: number;
  recruiting?: boolean;
  tagline?: string | null;
}

/**
 * The clans worth showing a stranger: real clans (not creator spaces) where somebody actually played
 * this week, busiest first. A clan nobody played in is not "running", so it is not listed.
 */
export function pickShowcaseClans<T extends ShowcaseClan>(rows: T[], limit = 6): T[] {
  return rows
    .filter((r) => r.kind === 'clan' && r.activeThisWeek > 0)
    .sort((a, b) => b.activeThisWeek - a.activeThisWeek || b.members - a.members || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Clans taking members now, for somebody with no clan: real clans only, the most active first. */
export function pickRecruitingClans<T extends ShowcaseClan>(rows: T[], limit = 3): T[] {
  return rows
    .filter((r) => r.kind === 'clan' && r.recruiting === true)
    .sort((a, b) => b.activeThisWeek - a.activeThisWeek || b.members - a.members || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export interface HeroCount {
  n: number;
  label: string;
}

/**
 * The real platform counts for the hero, each shown only once it is big enough to be worth saying.
 * A platform with 3 clans says nothing by counting them, so small figures are left out rather than
 * dressed up; the row of clans carries the proof instead.
 */
export function heroCounts(stats: { clans: number; members: number; eventsRun: number }): HeroCount[] {
  const out: HeroCount[] = [];
  if (stats.clans >= 10) out.push({ n: stats.clans, label: stats.clans === 1 ? 'clan' : 'clans' });
  if (stats.members >= 100) out.push({ n: stats.members, label: 'members' });
  if (stats.eventsRun >= 25) out.push({ n: stats.eventsRun, label: 'events run' });
  return out;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** A small count in words for prose ("seven"); digits beyond what the table covers. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
