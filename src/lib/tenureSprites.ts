// The Supporter tenure badges as pixel art, one 11x11 sprite per step (lib/supporterTiers
// TENURE_LADDER): a gem that grows four times, gains wings, then a laurel wreath for Legend. The
// plugin draws the same art from Anvil.Plugin's tenure.png (made by Anvil/tenure-sheet.py); this is
// the site's copy, for the name badge and the Discord author icon.
//   k = outline (the colour darkened), # = body (the colour), + = highlight (the colour lightened).

export const TENURE_SPRITES: readonly (readonly string[])[] = [
  ['...........', '...........', '...........', '.....k.....', '....k+k....', '...k+#+k...', '....k#k....', '.....k.....', '...........', '...........', '...........'],
  ['...........', '...........', '.....k.....', '....k+k....', '...k+#+k...', '..k+###+k..', '...k###k...', '....k#k....', '.....k.....', '...........', '...........'],
  ['...........', '.....k.....', '....k+k....', '...k+#+k...', '..k+###+k..', '.k+#####+k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....', '...........'],
  ['.....k.....', '....k+k....', '...k+#+k...', '..k+###+k..', '.k+#####+k.', 'k+#######+k', '.k#######k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....'],
  ['.....k.....', 'k...k+k...k', '+k.k+#+k.k+', '#+k+###+k+#', '##+#####+##', '#k#######k#', 'k.k#####k.k', '...k###k...', '....k#k....', '.....k.....', '...........'],
  ['.k...k...k.', 'k+k.k+k.k+k', '+#kk+#+kk#+', '#kk+###+kk#', '#k+#####+k#', '#+k#####k+#', 'k#kk###kk#k', '.k+kk#kk+k.', '..k++k++k..', '...kk.kk...', '...........'],
];

/** The three tones for a hex colour: outline, body, highlight. */
export function tenureTones(hex: string): { k: string; '#': string; '+': string } {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number, to: number, f: number) => Math.round(v + (to - v) * f);
  const mix = (to: number, f: number) => {
    const r = ch((n >> 16) & 255, to, f), g = ch((n >> 8) & 255, to, f), b = ch(n & 255, to, f);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };
  return { k: mix(0, 0.65), '#': `#${(n & 0xffffff).toString(16).padStart(6, '0')}`, '+': mix(255, 0.55) };
}
