// The Supporter tenure badge (lib/tenureSprites, the plugin's own pixel art) as a standalone SVG
// string, for pictures drawn off the page: the Discord author icon (api/og/supporter-star). The site
// draws the same sprite in React (components/SupporterName TenureBadge). Pure: colours are checked
// hex, the step is one of the ladder's ids; nothing else reaches the markup.

import { TENURE_LADDER, type TenureStepId } from './supporterTiers.ts';
import { TENURE_SIZE, TENURE_SPRITES, tenurePixel } from './tenureSprites.ts';
import { tenureColumnInks } from './tenureInks.ts';

export const STAR_PATH = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z';

/** A 64px picture: the step's badge in the first stop's tones; no step is the bare star in its stops. */
export function tenureStarSvg(stops: readonly string[], step: TenureStepId | null = null): string {
  if (!step) {
    const offsets = stops.map((h, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(3)}" stop-color="${h}"/>`).join('');
    const paint = stops.length === 1 ? stops[0] : 'url(#g)';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${offsets}</linearGradient></defs><path d="${STAR_PATH}" fill="${paint}"/></svg>`;
  }
  const k = Math.max(0, TENURE_LADDER.findIndex((t) => t.id === step));
  const inks = tenureColumnInks(stops, stops[0] ?? '#ffd35c');
  const px = TENURE_SPRITES[k]
    .flatMap((r, y) => [...r].map((ch, x) => (ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${tenurePixel(inks[x], ch)}"/>`)))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 ${TENURE_SIZE} ${TENURE_SIZE}" shape-rendering="crispEdges">${px}</svg>`;
}
