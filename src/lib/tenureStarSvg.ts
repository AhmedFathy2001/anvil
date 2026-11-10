// The Supporter star with its tenure frame (lib/supporterTiers TENURE_LADDER) as a standalone SVG
// string, for pictures drawn off the page: the Discord author icon (api/og/supporter-star). The site
// draws the same shapes in React (components/SupporterName TenureFrame). Pure: colours are already
// checked hex, the step is one of the ladder's ids; nothing else reaches the markup.

import type { TenureStepId } from './supporterTiers.ts';

export const STAR_PATH = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z';
const HEX = '12,1.4 21.2,6.7 21.2,17.3 12,22.6 2.8,17.3 2.8,6.7';
const SMALL = 'translate(12 12) scale(0.56) translate(-12 -11.6)';

function frame(step: TenureStepId, p: string): string {
  switch (step) {
    case 'journeyman':
      return `<circle cx="12" cy="12" r="10.4" fill="none" stroke="${p}" stroke-width="1.7"/>`;
    case 'artisan':
      return `<circle cx="12" cy="12" r="9" fill="none" stroke="${p}" stroke-width="1.6"/><circle cx="12" cy="12" r="11.3" fill="none" stroke="${p}" stroke-width="1" stroke-dasharray="1.6 2.2"/>`;
    case 'master':
      return `<polygon points="${HEX}" fill="rgba(0,0,0,0.35)" stroke="${p}" stroke-width="1.7" stroke-linejoin="round"/>`;
    case 'grandmaster':
      return `<polygon points="${HEX}" fill="none" stroke="${p}" stroke-width="1" stroke-linejoin="round"/><polygon points="${HEX}" transform="translate(12 12) scale(0.8) translate(-12 -12)" fill="rgba(0,0,0,0.35)" stroke="${p}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'legend':
      return `<g stroke="${p}" stroke-width="1.2" stroke-linecap="round" opacity="0.75"><path d="M12 0v2.2M12 21.8V24M0 12h2.2M21.8 12H24M3.5 3.5l1.5 1.5M19 19l1.5 1.5M20.5 3.5L19 5M5 19l-1.5 1.5"/></g><polygon points="${HEX}" transform="translate(12 12) scale(0.82) translate(-12 -12)" fill="${p}" fill-opacity="0.28" stroke="${p}" stroke-width="1.8" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

/** A 64px star (framed for every step past Apprentice) in one colour or a left-to-right gradient. */
export function tenureStarSvg(stops: readonly string[], step: TenureStepId = 'apprentice'): string {
  const offsets = stops.map((h, i) => `<stop offset="${(i / Math.max(1, stops.length - 1)).toFixed(3)}" stop-color="${h}"/>`).join('');
  const paint = stops.length === 1 ? stops[0] : 'url(#g)';
  const framed = step !== 'apprentice';
  const star = `<path d="${STAR_PATH}" fill="${paint}"${framed ? ` transform="${SMALL}"` : ''}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${offsets}</linearGradient></defs>${frame(step, paint)}${star}</svg>`;
}
