// Where a collection-log page's ticks stand against its "Uniques only" switch (lib/clogMinor marks
// the minor slots). Pure, no data import, so the editor can use it client-side.

export type ClogTickState = 'uniques' | 'all' | 'custom';

/** Every unique ticked and every minor slot unticked = 'uniques'; all ticked = 'all'; else 'custom'. */
export function clogTickState(items: readonly { id: number; minor?: boolean }[], ticked: ReadonlySet<number>): ClogTickState {
  let allOn = true;
  let uniquesOnly = items.some((it) => it.minor);
  for (const it of items) {
    const on = ticked.has(it.id);
    if (!on) allOn = false;
    if (on === !!it.minor) uniquesOnly = false;
  }
  if (uniquesOnly) return 'uniques';
  return allOn ? 'all' : 'custom';
}

/** The ids the page's items leave ticked under the switch: uniques only, or the whole page. */
export function clogTickIds(items: readonly { id: number; minor?: boolean }[], uniquesOnly: boolean): number[] {
  return items.filter((it) => !uniquesOnly || !it.minor).map((it) => it.id);
}
