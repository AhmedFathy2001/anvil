/** One comparison key for weekly standings, including OSRS/non-breaking whitespace variants. */
export function weeklyRsnKey(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}
