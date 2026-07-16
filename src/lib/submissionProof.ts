// Plugin-generated submission notes (kill counts, stat gains, loot values, deathless/timed runs, …)
// all start with this prefix — see AnvilPlugin.java. They aren't real proof: a 500-kill tile lands
// one submission per kill, each with the same auto note and no screenshot. So UIs that show a
// member's or tile's submissions aggregate these instead of listing hundreds of identical rows.
export const AUTO_NOTE_PREFIX = '[Auto]';

export function isAutoNote(note: string | null | undefined): boolean {
  return !!note && note.startsWith(AUTO_NOTE_PREFIX);
}

// A submission is worth listing on its own when it carries real proof: a screenshot, or a note a
// human actually wrote (not an auto plugin note). Everything else is a bare count log and gets
// rolled up into an aggregate line.
export function submissionHasProof(s: { imageUrl?: string | null; note?: string | null }): boolean {
  return !!s.imageUrl || (!!s.note && !isAutoNote(s.note));
}
