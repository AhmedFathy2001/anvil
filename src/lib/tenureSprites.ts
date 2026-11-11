// Made by Anvil/tenure-sheet.py (with the plugin's tenure.png); edit the masks there, not here.
// The Supporter tenure badges as pixel art, one 13x13 sprite per step (lib/supporterTiers
// TENURE_LADDER): a diamond that gets more precious. A gem, a brilliant cut, catching the light, set
// in a halo, halo and light, a laurel. Each letter is a tone of the name's colour (TENURE_TONE).

export const TENURE_SIZE = 13;

export const TENURE_SPRITES: readonly (readonly string[])[] = [
  ['.............', '......A......', '.....ACA.....', '....ACBCA....', '...ACBBBCA...', '..ACBBBBBCA..', '.ACBBBBBBBCA.', '..ACBBBBBDA..', '...ACBBBDA...', '....ACBDA....', '.....ACA.....', '......A......', '.............'],
  ['.............', '.............', '...AAAAAAA...', '.AALLLLLLLAA.', 'ACCCCCFFFFFFA', '.ACBBDFEEEGA.', '..ACBDFEEGA..', '...ACDFEGA...', '....ACFGA....', '.....AFA.....', '......A......', '.............', '.............'],
  ['.............', 'LA...ALA...AL', 'ALA..ALA..ALA', '.A.AAAAAAA.A.', '..ACLLLLLCA..', '.ACDLMMMMCCA.', 'ACDDFFFFFCDCA', 'AFFLLLLLLLFFA', '.AFFFLKMFFGA.', '..AFGLKMFGA..', '...AFFLFGA...', '....AFLFA....', '.....AFA.....'],
  ['.............', '....IIIII....', '..IIJ...III..', '.IJ.AAAAA.II.', '.I.ALLLLLA.I.', 'I.ALMMMMMLA.I', 'I.ACCCCFFFA.I', 'I..ACDFEGA..I', 'I...ACFGA...I', '.I...AFA...I.', '.II...A...IJ.', '..III...IIJ..', '....IIIIJ....'],
  ['.............', '....IILII....', '..IIJALAIII..', '.IJ.AAAAA.II.', '.I.ALLLLLA.I.', 'IAALMMMMMLAAI', 'LLACCCCFFFALL', 'IA.ACDFEGA.AI', 'I...ACFGA...I', '.I...AFA...I.', '.II...A...IJ.', '..IIIALAIIJ..', '....IILIJ....'],
  ['.............', 'LA...ALA...AL', 'ALA..ALA..ALA', '.A..AAAAA..A.', 'AIAALLLLLAAIA', 'IJALMMMMMLAII', 'IACCCCFFFFFAI', 'IAACBDFEEGAAI', 'IIAACDFEGAAIJ', 'AIIAACFGAAIJA', '.AIIAAFAAIJA.', '..AIIIAIIJA..', '...AAIAIAA...'],
];

/** Per letter (A = 1): mix the colour towards white (> 0) or black (< 0) by this much. */
export const TENURE_TONE: readonly number[] = [-0.72, 0, 0.5, -0.2, -0.45, -0.28, -0.58, -0.25, 0.15, -0.42, 0.6, 0.8, 0.4];

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, max ? d / max : 0, max / 255];
}

function hsvToRgb(h: number, s: number, v: number): number {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return (f(5) << 16) | (f(3) << 8) | f(1);
}

/**
 * The badge's colour from the name's: never a Jagex mod's colours. Greys, silver and white (a pmod's)
 * turn icy blue; gold and yellow (a jmod's) turn amber; everything else is kept. Same rule as the
 * plugin's AnvilPlugin.tenureInk.
 */
export function tenureInk(color: string): number {
  const n = /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : 0xffd35c;
  const [h, s, v] = rgbToHsv((n >> 16) & 255, (n >> 8) & 255, n & 255);
  if (s < 0.22) return hsvToRgb(0.58, Math.max(s, 0.55), Math.max(v, 0.85));
  if (h >= 0.105 && h <= 0.175 && s > 0.3) return hsvToRgb(0.075, s, v);
  return n;
}

/** The colour of one sprite letter for a name's colour. */
export function tenurePixel(ink: number, letter: string): string {
  const f = TENURE_TONE[letter.charCodeAt(0) - 65];
  const to = f > 0 ? 255 : 0, t = Math.abs(f);
  const ch = (sh: number) => Math.round(((ink >> sh) & 255) + (to - ((ink >> sh) & 255)) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
}
