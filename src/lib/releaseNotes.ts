// Release files (releases/<version>.md), pure: no `@/` imports, so the tests and scripts/promote.sh's
// checker run it directly.
//
// A release is written ONCE, for players and clan leaders, covering the site and the plugin together.
// It is user-facing: what you can now do, what got better, what got fixed — never internal reasons.
//
//   ---
//   version: 1.15.0
//   title: In-game chat feed and a fresh clan page
//   plugin: 1.15.0            (optional: the plugin version this release needs or ships with)
//   ---
//   ## News
//   A few plain sentences: what players and clan leaders will notice, why it matters, where to try
//   it. This is what gets ANNOUNCED (Discord, clans' Anvil updates, the plugin's login line).
//   ### Fixed                 (optional short lists under News: ### New / ### Improved / ### Fixed)
//   - Boards load on phones again. (from 1.14.2)
//   ## Highlights
//   - One line each, the two or three things worth knowing.
//   ## New
//   - [Plugin] Other players' big drops show in your chat while you play a board.
//   ## Improved
//   - Clan pages show what's live and let visitors open it.
//   ## Fixed
//   - Countdowns over a day read "4d 4h".
//
// The detailed sections (Highlights / New / Improved / Fixed) are the changelog: they live on
// /changelog only and never go to Discord or the plugin. A release without News is announced with
// its Highlights, else its first few New lines.
//
// Several releases often ship close together. They are announced as ONE post covering everything
// since the last announced version (`bundleReleases`): News merged and deduplicated, and a fix whose
// `(from x.y.z)` marker names a version players never saw announced is left out — the post never
// reads "1.19.1 broke it, 1.19.2 fixed it". The marker is never shown to players.

export interface ReleaseNote {
  version: string;
  title: string;
  pluginVersion: string | null;
  /**
   * `silent: true` in the front matter: production ships it without posting it anywhere (Discord,
   * clans' Anvil updates, /changelog, the plugin's login line). It goes out later — with the next
   * release that isn't silent, oldest first, or when staff press "Announce now" on /staff/releases.
   */
  silent: boolean;
  /**
   * The announcement: `## News` (or front-matter `news:`), as paragraphs. Optional, and missing on
   * releases stored before it existed.
   */
  news?: string[];
  /** Short lists under News (`### New` / `### Improved` / `### Fixed`); announced, merged per batch. */
  newsAdded?: string[];
  newsImproved?: string[];
  newsFixed?: string[];
  /**
   * Set on the stored copy when announced: the newest version announced before this one's batch, so
   * the plugin's login line can rebuild the same bundle. Never in a release file.
   */
  announcedSince?: string | null;
  /** `whats_new: true`: the announcement also links /whats-new (it has an entry for this release). */
  whatsNew?: boolean;
  highlights: string[];
  added: string[];
  improved: string[];
  fixed: string[];
}

const SECTION: Record<string, keyof Pick<ReleaseNote, 'highlights' | 'added' | 'improved' | 'fixed'>> = {
  highlights: 'highlights',
  new: 'added',
  improved: 'improved',
  fixed: 'fixed',
};

export const VERSION_RE = /^\d+\.\d+\.\d+$/;

/** Parse one release file; throws with a readable reason when it isn't one. */
export function parseReleaseNote(text: string): ReleaseNote {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n').trimStart());
  if (!m) throw new Error('missing the --- front matter --- block');
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  if (!VERSION_RE.test(meta.version ?? '')) throw new Error('version must look like 1.15.0');
  if (!meta.title) throw new Error('title is required');
  const out: ReleaseNote = {
    version: meta.version,
    title: meta.title.slice(0, 120),
    pluginVersion: meta.plugin && VERSION_RE.test(meta.plugin) ? meta.plugin : null,
    silent: /^(?:true|yes|1)$/i.test(meta.silent ?? ''),
    news: [],
    newsAdded: [],
    newsImproved: [],
    newsFixed: [],
    whatsNew: /^(?:true|yes|1)$/i.test(meta.whats_new ?? ''),
    highlights: [],
    added: [],
    improved: [],
    fixed: [],
  };
  // News is prose: lines join into paragraphs, a blank line starts a new one; `- ` lines are allowed.
  const news: string[] = [];
  let para: string[] = [];
  const endPara = () => {
    if (para.length) news.push(para.join(' '));
    para = [];
  };
  if (meta.news) news.push(meta.news);
  let inNews = false;
  let newsList: 'newsAdded' | 'newsImproved' | 'newsFixed' | null = null;
  const NEWS_LIST: Record<string, 'newsAdded' | 'newsImproved' | 'newsFixed'> = { new: 'newsAdded', improved: 'newsImproved', fixed: 'newsFixed' };
  let current: keyof typeof SECTION | null = null;
  for (const raw of m[2].split('\n')) {
    const line = raw.trim();
    const sub = /^###\s+(.+)$/.exec(line);
    if (sub && inNews) {
      endPara();
      newsList = NEWS_LIST[sub[1].trim().toLowerCase()] ?? null;
      continue;
    }
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      newsList = null;
      const key = h[1].trim().toLowerCase();
      endPara();
      inNews = key === 'news';
      current = key in SECTION ? (key as keyof typeof SECTION) : null;
      continue;
    }
    if (inNews) {
      const bullet = /^[-*]\s+(.+)$/.exec(line);
      if (newsList) {
        if (bullet) out[newsList]!.push(bullet[1].trim().slice(0, 300));
        continue;
      }
      if (!line) endPara();
      else if (bullet) {
        endPara();
        para.push(bullet[1]);
        endPara();
      } else para.push(line);
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item && current) out[SECTION[current]].push(item[1].trim().slice(0, 300));
  }
  endPara();
  out.news = news.map((p) => p.slice(0, 600)).filter(Boolean).slice(0, 6);
  if (!out.highlights.length && !out.added.length && !out.improved.length && !out.fixed.length) {
    throw new Error('nothing under Highlights, New, Improved or Fixed');
  }
  return out;
}

/** Newest first by semantic version. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  return 0;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Where a release's full notes are: its card on /changelog. */
export function changelogUrl(version: string, origin: string): string {
  return `${origin}/changelog#v${version}`;
}

const MARKER_RE = /\s*\((?:from|follow-up to)\s+(\d+\.\d+\.\d+)\)\s*$/i;

/** An item's `(from 1.19.1)` marker split off: the text players see, and the version it follows up. */
export function splitMarker(item: string): { text: string; from: string | null } {
  const m = MARKER_RE.exec(item);
  return m ? { text: item.slice(0, m.index).trim(), from: m[1] } : { text: item, from: null };
}

/** Two lines are "the same item" when they match ignoring case, tags, markers and end punctuation. */
const itemKey = (s: string) =>
  splitMarker(s)
    .text.toLowerCase()
    .replace(/^\[[a-z ]+\]\s*/, '')
    .replace(/[\s.!…]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** One announcement: every release since the last announced one, as players will read it. */
export interface ReleaseBundle {
  /** The newest version in the batch: the header and the changelog link. */
  version: string;
  title: string;
  /** Every version it covers, oldest first. */
  versions: string[];
  pluginVersion: string | null;
  whatsNew: boolean;
  /** News paragraphs (or the Highlights of a release without News), deduplicated. */
  prose: string[];
  added: string[];
  improved: string[];
  fixed: string[];
}

/**
 * Merge the releases going out together into one announcement. `lastAnnounced` is the newest
 * version players last saw announced (null: none yet). Only News goes in (else Highlights, else the
 * first three New lines); the detailed Fixed list never does. Duplicates collapse to their first
 * appearance, New before Improved before Fixed; a fix marked `(from x.y.z)` for a version newer than
 * `lastAnnounced` is dropped, since players never saw that bug announced. Markers are stripped.
 */
export function bundleReleases(notes: readonly ReleaseNote[], lastAnnounced: string | null): ReleaseBundle {
  if (!notes.length) throw new Error('nothing to bundle');
  const batch = [...notes].sort((a, b) => compareVersions(b.version, a.version));
  const newest = batch[batch.length - 1];
  const seen = new Set<string>();
  const take = (into: string[], item: string) => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    into.push(splitMarker(item).text);
  };
  const out: ReleaseBundle = {
    version: newest.version,
    title: newest.title,
    versions: batch.map((n) => n.version),
    pluginVersion: [...batch].reverse().find((n) => n.pluginVersion)?.pluginVersion ?? null,
    whatsNew: batch.some((n) => n.whatsNew),
    prose: [],
    added: [],
    improved: [],
    fixed: [],
  };
  const unseen = (v: string) => lastAnnounced == null || compareVersions(v, lastAnnounced) < 0;
  const added: string[] = [];
  const improved: string[] = [];
  const fixed: string[] = [];
  for (const n of batch) {
    const hasNews = !!(n.news?.length || n.newsAdded?.length || n.newsImproved?.length || n.newsFixed?.length);
    if (hasNews) {
      out.prose.push(...(n.news ?? []));
      added.push(...(n.newsAdded ?? []));
      improved.push(...(n.newsImproved ?? []));
      fixed.push(...(n.newsFixed ?? []).filter((f) => {
        const from = splitMarker(f).from;
        return !(from && unseen(from));
      }));
    } else if (n.highlights?.length) out.prose.push(...n.highlights);
    else added.push(...(n.added ?? []).slice(0, 3));
  }
  const prose = out.prose;
  out.prose = [];
  for (const p of prose) take(out.prose, p);
  for (const x of added) take(out.added, x);
  for (const x of improved) take(out.improved, x);
  for (const x of fixed) take(out.fixed, x);
  return out;
}

function whereLine(b: ReleaseBundle): string {
  return b.pluginVersion ? `Plugin ${b.pluginVersion}: update RuneLite to get it.` : 'Live on anvilosrs.com now.';
}

function linkLines(b: ReleaseBundle, origin: string): string[] {
  return [...(b.whatsNew ? [`What's new for you: ${origin}/whats-new`] : []), `Full changelog: ${changelogUrl(b.version, origin)}`];
}

function bodyBlocks(b: ReleaseBundle, heading: (s: string) => string): string[] {
  const blocks = [...b.prose];
  for (const [label, xs] of [['New', b.added], ['Improved', b.improved], ['Fixed', b.fixed]] as const) {
    if (xs.length) blocks.push([heading(label), ...xs.map((x) => `• ${x}`)].join('\n'));
  }
  return blocks;
}

/** The announcement as plain text, exactly the words the post carries. What promote.sh shows. */
export function announcementText(b: ReleaseBundle, origin: string): string {
  return [`Anvil ${b.version}: ${b.title}`, '', bodyBlocks(b, (s) => s).join('\n\n'), '', whereLine(b), ...linkLines(b, origin)].join('\n');
}

/** The Discord embed: the same for #anvil-announcements and every clan's "Anvil updates". */
export function announcementEmbed(b: ReleaseBundle, origin: string) {
  const tail = `\n\n-# ${whereLine(b)}\n${linkLines(b, origin).join('\n')}`;
  return {
    title: clip(`Anvil ${b.version}: ${b.title}`, 256),
    url: changelogUrl(b.version, origin),
    // Where it is as Discord's small muted subtext. Not the footer: every Anvil post's footer is
    // "Powered by Anvil", stamped when it's sent, which would replace it.
    description: clip(bodyBlocks(b, (s) => `**${s}**`).join('\n\n'), 4000 - tail.length) + tail,
    color: 0xe0aa1e,
  };
}

/** One release announced on its own (the /staff Discord samples). */
export function releaseEmbed(r: ReleaseNote, origin: string) {
  return announcementEmbed(bundleReleases([r], r.announcedSince ?? null), origin);
}

/** The one chat line the plugin prints at the first login after an announcement. */
export function announcementBriefLine(b: ReleaseBundle, origin = 'https://anvilosrs.com'): string {
  const link = ` · Full changelog: ${changelogUrl(b.version, origin).replace(/^https?:\/\//, '')}`;
  const title = /[.!?]$/.test(b.title) ? b.title : `${b.title}.`;
  const words = [...b.prose, ...b.added, ...b.improved, ...b.fixed].map((x) => (/[.!?…]$/.test(x) ? x : `${x}.`));
  return clip(`New in Anvil ${b.version}: ${[title, ...words].join(' ')}`, 300 - link.length) + link;
}

/**
 * Is this release due to be announced? A loud one always is. A silent one waits until a LATER
 * release that isn't silent ships (it then goes out with that backlog, oldest first), or until staff
 * asked for it by version (`announceNow`).
 */
export function releaseIsDue(note: Pick<ReleaseNote, 'version' | 'silent'>, all: readonly Pick<ReleaseNote, 'version' | 'silent'>[], announceNow: ReadonlySet<string>): boolean {
  if (!note.silent || announceNow.has(note.version)) return true;
  return all.some((o) => !o.silent && compareVersions(note.version, o.version) > 0);
}
