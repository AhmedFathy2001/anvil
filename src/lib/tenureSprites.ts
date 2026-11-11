// Made by Anvil/tenure-sheet.py (with the plugin's tenure.png); edit the masks there, not here.
// The Supporter tenure badges as pixel art, one 11x11 sprite per step (lib/supporterTiers
// TENURE_LADDER), each a fixed OSRS gem in the game's order: sapphire, emerald, ruby, diamond,
// dragonstone, then a zenyte laurel for Legend. Fixed colours, never the name's: the gem says the tier.
//   k = outline, # = body, + = highlight.

export const TENURE_SPRITES: readonly (readonly string[])[] = [
  ['...........', '...........', '...kkkkk...', '..k+++++k..', '.k+#####+k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....', '...........', '...........'],
  ['...........', '...kkkkk...', '..k+++++k..', '.k+#####+k.', 'k+#######+k', '.k#######k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....', '...........'],
  ['...........', '..kkkkkkk..', '.k+++++++k.', 'k+#######+k', '+#########+', 'k#########k', '.k#######k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....'],
  ['...........', '..kkkkkkk..', '.k+++++++k.', 'k+#######+k', '+#########+', 'k#########k', '.k#######k.', '..k#####k..', '...k###k...', '....k#k....', '.....k.....'],
  ['.k.......k.', 'k+kkkkkkk+k', '+k+++++++k+', '#+#######+#', '###########', '#k#######k#', 'kk#######kk', '..k#####k..', '...k###k...', '....k#k....', '.....k.....'],
  ['.k...k...k.', 'k+k.k+k.k+k', '+#kk+#+kk#+', '#kk+###+kk#', '#k+#####+k#', '#+k#####k+#', 'k#kk###kk#k', '.k+kk#kk+k.', '..k++k++k..', '...kk.kk...', '...........'],
];

export type TenureTones = { k: string; '#': string; '+': string };

/** Each step's three tones. */
export const TENURE_TONES: readonly TenureTones[] = [
  { k: '#10264e', '#': '#2f6fdf', '+': '#a1bef0' },
  { k: '#104221', '#': '#2fbf5f', '+': '#a1e2b7' },
  { k: '#4b1019', '#': '#d8304a', '+': '#eda1ad' },
  { k: '#3a5a7a', '#': '#d6eeff', '+': '#ecf7ff' },
  { k: '#3d1a4e', '#': '#b04ce0', '+': '#dbaef1' },
  { k: '#59350e', '#': '#ff9a2a', '+': '#ffd19f' },
];
