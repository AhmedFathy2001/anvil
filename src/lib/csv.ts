// A spreadsheet file from rows, for the staff exports. Pure.
//
// Every cell is quoted, and a cell that a spreadsheet would run as a formula (it starts with = + - @,
// a tab or a carriage return) is led with an apostrophe: clan and character names are typed by
// strangers, and an export opened in a spreadsheet must stay text.

export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(value: CsvCell): string {
  if (value == null) return '""';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(head: string[], rows: CsvCell[][]): string {
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** A response a browser saves as `<name>.csv`. The BOM makes Excel read it as UTF-8. */
export function csvResponse(name: string, body: string): Response {
  return new Response(`﻿${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name.replace(/[^a-z0-9._-]/gi, '-')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
