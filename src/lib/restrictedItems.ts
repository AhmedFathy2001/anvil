// Copies of gear that work only somewhere else, never in main-game PvM: Bounty Hunter (bh) and
// Deadman copies, Last Man Standing, Pete Kayer's challenges, Leagues (Trailblazer) and historical
// copies, the Gauntlet's crystal and corrupted gear, Castle Wars ammo. Nothing that picks gear from
// a player's bank (the guide's "Your version", the pre-trip calc) ever picks or suggests them.
// Locked "(l)" items are the real thing and stay. PURE: names only.

const RESTRICTED = /\((bh|deadman|deadman mode|dmm|beta|lms|last man standing|pete kayer's challenges|the gauntlet|trailblazer reloaded|historical|basic|attuned|perfected)\)|^corrupted |^castle wars (arrow|bolts)/i;

/** Is this a restricted copy (by its item name)? */
export const isRestricted = (name: string | null | undefined): boolean => !!name && RESTRICTED.test(name.trim());
