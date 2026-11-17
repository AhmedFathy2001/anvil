// One counting rule for a competition's headcount, so the home card, the clan header, the weekly
// page and the admin workspace can't tell four different stories about the same boss of the week.
//
//   entered = everyone enrolled in it.
//   scored  = enrolled people whose gain is above zero.
//
// Pure, no imports: tests/weekly-count-words.test.ts runs it directly.

/** How many of the entered have scored. A gain of zero (or less, or unknown) is not a score. */
export function countScored(gains: ReadonlyArray<number | null | undefined>): { entered: number; scored: number } {
  let scored = 0;
  for (const g of gains) if (typeof g === 'number' && g > 0) scored++;
  return { entered: gains.length, scored };
}

/** "9 of 170 have scored" — the one sentence for the pair. */
export function scoredOfEntered(scored: number, entered: number): string {
  return `${scored} of ${entered} ${scored === 1 && entered === 1 ? 'has' : 'have'} scored`;
}

/** "170 entered" — the one label for the headcount on its own. */
export function enteredWord(entered: number): string {
  return `${entered} entered`;
}
