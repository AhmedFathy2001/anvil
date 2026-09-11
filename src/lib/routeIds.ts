// An id out of a URL is a string somebody else chose.
//
// `parseInt('null', 10)` is NaN, and NaN goes into a query as happily as 7 does — right up to
// Postgres, which refuses it and takes the whole render down with a 500. So a link rendered with a
// null id, which is a display bug worth a 404, became a server error instead. Two of them were live:
// `/weekly/null` and `/events/<n>/teams/null`, and the only reason there were not more is that the
// guarded lookups — `eventInClan`, `competitionInClan` — already refuse a non-integer, which is this
// same rule written in the one place the id is USED rather than where it arrives.
//
// This is that rule for the ids with no such lookup. A page whose address does not parse is not a
// page: 404, the same answer as an id that parses and names nothing, because from outside they are
// indistinguishable and both mean "there is nothing here".
//
// POSITIVE INTEGERS ONLY. `parseInt` is happy with '7abc' (7), '-1' and '1e3' (1), so a bare
// Number.isInteger check on its output still lets three kinds of nonsense through to a query.

import { notFound } from 'next/navigation';

/** The id this address names, or a 404 if it does not name one. Server components only. */
export function idParam(raw: string | undefined): number {
  const id = idOrNull(raw);
  if (id == null) notFound();
  return id;
}

/** As {@link idParam}, for callers that would rather decide for themselves. */
export function idOrNull(raw: string | undefined): number | null {
  if (!raw || !/^[0-9]+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
