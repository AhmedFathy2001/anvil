// One ink per sprite column for a tenure badge: a gradient name's stops, left to right like the text,
// or one colour throughout. Shared by the site badge (components/SupporterName) and the Discord picture
// (lib/tenureStarSvg), so the two never disagree. Pure.
import { TENURE_SIZE, tenureInk } from './tenureSprites.ts';

const rgb = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? parseInt(c.slice(1), 16) : 0xffd35c);

/** The colour `t` (0–1) of the way along evenly spaced hex stops; a non-hex stop reads as gold. */
function stopAt(stops: readonly string[], t: number): string {
  const pos = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = rgb(stops[i]), b = rgb(stops[i + 1]);
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function tenureColumnInks(stops: readonly string[] | null | undefined, color: string): number[] {
  return Array.from({ length: TENURE_SIZE }, (_, x) =>
    tenureInk(stops && stops.length >= 2 ? stopAt(stops, TENURE_SIZE > 1 ? x / (TENURE_SIZE - 1) : 0) : color),
  );
}
