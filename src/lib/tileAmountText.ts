// Keeping a tile's written title and description in step with its amount.
//
// A tile's label ("50 Kraken KC") and description ("Reach 50 Kraken kill count") are generated from
// its amount, but nothing re-generated them when the amount was edited, so a tile with a goal of 75
// went on saying 50 to every player. These pure helpers swap the OLD amount for the NEW one inside
// the text. Text that never mentioned the old amount was written by hand and is left alone.

/** A number as written in a label: "50", "1,000", "2.5k", "5M". */
export function parseAmountToken(num: string, suffix?: string | null): number | null {
  const n = parseFloat(num.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const s = (suffix ?? '').toLowerCase();
  const mult = s === 'k' ? 1e3 : s === 'm' ? 1e6 : s === 'b' ? 1e9 : 1;
  return Math.round(n * mult);
}

function shortOr(n: number): string {
  if (n >= 1_000_000 && n % 100_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 10_000 && n % 1_000 === 0) return `${n / 1_000}k`;
  return n.toLocaleString('en-US');
}

// A number token not glued to letters or digits ("x100" and "T3" are not amounts).
const NUM_RE = /(?<![A-Za-z0-9.,])(\d[\d,]*(?:\.\d+)?)([kmbKMB])?(?![A-Za-z0-9])/g;

/** Does the text write this amount somewhere? */
export function mentionsAmount(text: string, n: number): boolean {
  for (const m of text.matchAll(NUM_RE)) if (parseAmountToken(m[1], m[2]) === n) return true;
  return false;
}

/**
 * The text with every mention of `from` rewritten to `to`, in the same style (a "5M" stays short,
 * "1,000" keeps its comma). null when the text does not mention `from` — it was written by hand.
 */
export function retitleForAmount(text: string, from: number, to: number): string | null {
  if (!text || from === to || !mentionsAmount(text, from)) return null;
  return text.replace(NUM_RE, (all, num: string, suffix?: string) => {
    if (parseAmountToken(num, suffix) !== from) return all;
    return suffix || (from >= 10_000 && !num.includes(',')) ? shortOr(to) : to.toLocaleString('en-US');
  });
}
