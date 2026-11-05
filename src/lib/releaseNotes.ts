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
//   ## Highlights
//   - One line each, the two or three things worth knowing.
//   ## New
//   - [Plugin] Other players' big drops show in your chat while you play a board.
//   ## Improved
//   - Clan pages show what's live and let visitors open it.
//   ## Fixed
//   - Countdowns over a day read "4d 4h".

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
    highlights: [],
    added: [],
    improved: [],
    fixed: [],
  };
  let current: keyof typeof SECTION | null = null;
  for (const raw of m[2].split('\n')) {
    const line = raw.trim();
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      const key = h[1].trim().toLowerCase();
      current = key in SECTION ? (key as keyof typeof SECTION) : null;
      continue;
    }
    const item = /^[-*]\s+(.+)$/.exec(line);
    if (item && current) out[SECTION[current]].push(item[1].trim().slice(0, 300));
  }
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
const bullets = (xs: string[], max: number) => {
  const shown = xs.slice(0, max).map((x) => `• ${x}`);
  if (xs.length > max) shown.push(`…and ${xs.length - max} more`);
  return clip(shown.join('\n'), 1000);
};

/** The Discord embed a release is announced with: the same for #anvil-announcements and for clans. */
export function releaseEmbed(r: ReleaseNote, origin: string) {
  const fields = [
    r.added.length ? { name: 'New', value: bullets(r.added, 8) } : null,
    r.improved.length ? { name: 'Improved', value: bullets(r.improved, 8) } : null,
    r.fixed.length ? { name: 'Fixed', value: bullets(r.fixed, 8) } : null,
  ].filter((f): f is { name: string; value: string } => f != null);
  return {
    title: clip(`Anvil ${r.version}: ${r.title}`, 256),
    url: `${origin}/changelog#v${r.version}`,
    // Where it is, as Discord's small muted subtext under the highlights. Not the footer: every Anvil
    // post's footer is "Powered by Anvil", stamped when it's sent, which would replace it.
    description: clip(
      [...r.highlights.map((h) => `• ${h}`), `-# ${r.pluginVersion ? `Plugin ${r.pluginVersion} · update RuneLite to get it` : 'Live on anvilosrs.com now'}`].join('\n'),
      2000,
    ),
    color: 0xe0aa1e,
    fields,
  };
}

/** The one chat line the plugin prints at the first login after a release. */
export function releaseBriefLine(r: ReleaseNote): string {
  const lead = r.highlights[0] ?? r.title;
  return clip(`New in Anvil ${r.version}: ${lead} · anvilosrs.com/changelog`, 150);
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
