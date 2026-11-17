// Two things a quick-add line can carry beside the task itself (lib/taskMatch parseBulkLine reads
// its points): the tile's own NAME, and, for a list that was spoken, turning speech into lines.
//
// Pure: the dialog (components/tile-creator/BulkQuickAdd) and the tests use it directly.

/**
 * A line's name for its tile, and the line without it. Three ways to write it, all optional:
 *
 *   25 rumours called Rumour mill          (also "named", "name it", "as")
 *   25 rumours "Rumour mill"               (quotes at the end)
 *   Rumour mill: 25 rumours                (a name with no number in it, before a task that starts with one)
 *
 * No name → the tile keeps the name its task has. A name is cut to 80 characters.
 */
export function splitLineName(line: string): { text: string; name: string | null } {
  const trimmed = line.trim();
  const clean = (s: string) => s.trim().replace(/^["“”'‘’]+|["“”'‘’.]+$/g, '').trim().slice(0, 80);
  const done = (text: string, name: string) => {
    const n = clean(name);
    const t = text.trim().replace(/[,;:\-–—]\s*$/, '').trim();
    return n && t ? { text: t, name: n } : null;
  };

  // "… called X", "… named X", "… name it X". The LAST one wins, so a task that happens to contain
  // the word earlier still works.
  const said = /^(.*\S)\s+(?:called|named|name it|name)\s*[:=]?\s+(.+)$/i.exec(trimmed);
  if (said) {
    const hit = done(said[1], said[2]);
    if (hit) return hit;
  }
  // Quotes at the end: 25 rumours "Rumour mill"
  const quoted = /^(.*\S)\s+["“]([^"“”]{1,80})["”]\s*$/.exec(trimmed);
  if (quoted) {
    const hit = done(quoted[1], quoted[2]);
    if (hit) return hit;
  }
  // "Name: 25 something" — only when the left side has no digit and the right side starts with one,
  // so "CoX or ToB: any mode" and "points: 500" are left alone.
  const lead = /^([^:\d]{2,80}):\s*(\d.*)$/.exec(trimmed);
  if (lead && !/^points?$/i.test(lead[1].trim())) {
    const hit = done(lead[2], lead[1]);
    if (hit) return hit;
  }
  return { text: trimmed, name: null };
}

/**
 * A whole line: its task, its points and its name, whichever order the last two were written in
 * ("25 rumours called Rumour mill 20 points" and "25 rumours 20 points called Rumour mill" are the
 * same tile). `readPoints` is lib/taskMatch parseBulkLine, passed in so this file stays free of it.
 */
export function readQuickLine(
  line: string,
  readPoints: (line: string) => { text: string; points: number | null },
): { text: string; points: number | null; name: string | null } {
  const named = splitLineName(line);
  if (named.name) {
    // Points may sit at the end of the name ("… called Rumour mill 20 points") or of the task.
    const inName = readPoints(named.name);
    if (inName.points != null && inName.text) return { text: readPoints(named.text).text, points: inName.points, name: inName.text };
    const rest = readPoints(named.text);
    return { text: rest.text, points: rest.points, name: named.name };
  }
  const pts = readPoints(line);
  const after = splitLineName(pts.text);
  return { text: after.text, points: pts.points, name: after.name };
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, million: 1_000_000 };
const isNumberWord = (w: string) => w in UNITS || w in TENS || w in SCALES;

/**
 * Number words as digits: "twenty five rumours" → "25 rumours", "a hundred and fifty herbiboars" →
 * "150 herbiboars", "two thousand" → "2000". A lone "one" or "a" that is not part of a number is
 * left as a word only when nothing numeric follows ("one of each" stays readable as "1 of each").
 */
export function numberWordsToDigits(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const bare = (k: number) => words[k]?.toLowerCase().replace(/[.,]$/g, '').replace(/-/g, ' ') ?? '';
    // "a hundred", "a thousand"
    const startsScale = (bare(i) === 'a' || bare(i) === 'an') && bare(i + 1) in SCALES;
    const first = bare(i).split(' ')[0];
    if (!startsScale && !isNumberWord(first)) {
      out.push(words[i]);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let used = 0;
    let j = i;
    let trailing = '';
    for (; j < words.length; j++) {
      const raw = bare(j);
      const parts = raw.split(' ').filter(Boolean);
      if (j === i && startsScale) {
        current = 1;
        used++;
        continue;
      }
      // "and" inside a number: "a hundred and fifty"
      if (raw === 'and' && used > 0 && isNumberWord(bare(j + 1).split(' ')[0])) continue;
      if (!parts.length || !parts.every(isNumberWord)) break;
      for (const p of parts) {
        if (p in UNITS) current += UNITS[p];
        else if (p in TENS) current += TENS[p];
        else if (p === 'hundred') current = (current || 1) * 100;
        else {
          total += (current || 1) * SCALES[p];
          current = 0;
        }
      }
      used++;
      trailing = /[.,]$/.test(words[j]) ? words[j].slice(-1) : '';
      if (trailing) {
        j++;
        break;
      }
    }
    out.push(String(total + current) + trailing);
    i = j;
  }
  return out.join(' ');
}

/** Words that mean "that tile is done, here comes the next one". */
const NEXT = /\s*(?:\b(?:next tile|next one|next line|new line|new tile|next)\b[.,]?|[\n;])\s*/gi;

/**
 * What was said, as list lines: number words become digits, "next" / "new line" starts a new line,
 * "twenty points" at the end of a line becomes its points, and a spoken "called X" stays for
 * splitLineName. Each line gets a capital letter dropped and its full stop removed.
 */
export function spokenToLines(transcript: string): string[] {
  return transcript
    .replace(NEXT, '\n')
    .split('\n')
    .map((l) => numberWordsToDigits(l.trim()).replace(/[.?!]+$/, '').trim())
    .map((l) => l.replace(/\s+(?:for|worth)\s+(\d+(?:\.\d+)?k?)\s+points?$/i, ' – $1 pts'))
    .filter((l) => l.replace(/[^a-z0-9]/gi, '').length >= 2);
}
