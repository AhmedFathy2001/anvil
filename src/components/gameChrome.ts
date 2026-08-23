// The look of an Old School interface, as close as CSS gets: a brown panel with a bevel, a recessed
// list well, and the game's own text colours.
//
// Kept in one place because the profile draws three of these panels and they have to agree — a
// "nearly the same brown" reads as a mistake far louder than a different colour would.

/** Interface brown, and the two edges that make a panel look raised. */
export const PANEL = 'bg-[#3b3529] border-t border-l border-[#635946] border-b border-r border-[#231f18]';
/** The inset well a list or a field sits in: the same bevel, inverted. */
export const WELL = 'bg-[#2b2620] border-t border-l border-[#231f18] border-b border-r border-[#5a5142]';
/** A tab or button at rest, and the same when it's the one you're on. */
export const TAB = 'bg-[#3b3529] border-t border-l border-[#635946] border-b border-r border-[#231f18] text-[#e2dbc8]';
export const TAB_ON = 'bg-[#5a5142] border-t border-l border-[#7a7060] border-b border-r border-[#231f18] text-[#ff981f]';

/** The game's own text colours — the ones every player already reads without a legend. */
export const RS_ORANGE = '#ff981f';
export const RS_TEXT = '#e2dbc8';
export const RS_DIM = '#9d9784';

/** Quest-journal states, in the game's colours: red not started, yellow started, green complete. */
export const RS_STATE: Record<number, string> = {
  0: '#ff3b3b',
  1: '#ffcc00',
  2: '#33dd33',
};
