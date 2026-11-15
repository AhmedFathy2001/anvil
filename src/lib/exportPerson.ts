// "Download my data": everything Anvil holds about the signed-in person, as one JSON document.
//
// Built from the SAME list the deletion walks (lib/personData PERSON_DATA), so a table cannot be
// deleted-but-never-shown or shown-but-never-deleted. Each row of that list that has an `export`
// names the columns allowed out; nothing else leaves. redactRow drops secrets and staff notes a
// second time, whatever the list says.
//
// ONLY THEIR OWN ROWS. Every query is `where <column> in (<their ids>)`: their login, their person,
// their characters, their seats, their event entries. Nothing is read by clan or by event, so other
// people's rows are never in reach. Proof images are links, never bytes.
//
// SIZE-BOUNDED: at most EXPORT_ROW_CAP rows per table (newest ids are not special-cased; a table
// that hit the cap is listed under `truncated` so the reader knows it is not the whole of it).

import { eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, users } from '@/db/schema';
import { personIdsFor } from '@/lib/erasePerson';
import { PERSON_DATA, redactRow } from '@/lib/personData';

export const EXPORT_ROW_CAP = 5000;

export interface PersonExport {
  about: { what: string; generatedAt: string; rowCapPerTable: number };
  /** section → rows. A section may gather several tables (each row says which). */
  data: Record<string, Record<string, unknown>[]>;
  /** Tables cut off at the cap. */
  truncated: string[];
}

const ident = (name: string) => sql.identifier(name);

export async function exportPerson(userId: number): Promise<PersonExport | null> {
  const [user] = await db.select({ id: users.id, playerId: users.playerId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const ids = await personIdsFor(userId, user.playerId);

  const data: PersonExport['data'] = {};
  const truncated: string[] = [];
  for (const entry of PERSON_DATA) {
    if (!entry.export) continue;
    const keyIds = ids[entry.key];
    if (keyIds.length === 0) continue;
    const columns = entry.export.columns;
    const rows = (
      await db.execute(sql`
        select ${sql.join(columns.map((c) => ident(c)), sql`, `)}
        from ${ident(entry.table)}
        where ${ident(entry.column)} in (${sql.join(keyIds.map((id) => sql`${id}`), sql`, `)})
        limit ${EXPORT_ROW_CAP + 1}
      `)
    ).rows as Record<string, unknown>[];
    if (rows.length > EXPORT_ROW_CAP) {
      rows.length = EXPORT_ROW_CAP;
      truncated.push(entry.table);
    }
    if (rows.length === 0) continue;
    const section = (data[entry.export.section] ??= []);
    for (const row of rows) section.push({ _from: entry.table, ...redactRow(entry.table, columns, row) });
  }

  // The clans those rows mention, by name: a bare clan number tells the reader nothing.
  const clanIds = new Set<number>();
  for (const rows of Object.values(data)) for (const row of rows) if (typeof row.clan_id === 'number') clanIds.add(row.clan_id);
  if (clanIds.size > 0) {
    // clan-scope: global -- only the clans this person's own rows already name.
    const named = await db.select({ id: clans.id, name: clans.name, slug: clans.slug }).from(clans).where(inArray(clans.id, [...clanIds]));
    data.clans_mentioned = named.map((c) => ({ _from: 'clans', ...c }));
  }

  return {
    about: {
      what: 'Everything Anvil holds about your account. Proof images are links. Sign-in keys and plugin tokens are never included.',
      generatedAt: new Date().toISOString(),
      rowCapPerTable: EXPORT_ROW_CAP,
    },
    data,
    truncated,
  };
}
