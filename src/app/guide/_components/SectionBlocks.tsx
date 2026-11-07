import { AccessTable, Note, Rows } from './GuideUI';
import { items, paragraphs, rows, rt, type Vars } from '../_i18n/rich';

/**
 * One guide section's dictionary entry, rendered in a fixed order: intro, paragraphs, numbered steps,
 * term/body rows, a grid, closing line, note. For the guides whose sections are all built from those
 * same parts (supporter, side panel, clan boosts), so each page keeps its <Section> list and anchors
 * and this keeps the markup in one place. Any part a section doesn't have is skipped.
 */
export interface SectionCopy {
  intro?: string;
  body?: readonly string[];
  steps?: readonly string[];
  rows?: readonly { term: string; body: string }[];
  table?: {
    areaLabel: string;
    columns: readonly string[];
    rows: readonly { area: string; cells: readonly string[] }[];
  };
  outro?: string;
  note?: { tag: string; body: string };
}

export function SectionBlocks({ s, v = {} }: { s: SectionCopy; v?: Vars }) {
  return (
    <>
      {s.intro && <p className="text-text-muted">{rt(s.intro, v)}</p>}
      {paragraphs(s.body, v)}
      {s.steps && <ol className="list-decimal space-y-1.5 ps-5 text-sm text-text-muted">{items(s.steps, v)}</ol>}
      {s.rows && <Rows rows={rows(s.rows, v)} />}
      {s.table && (
        <AccessTable
          areaLabel={s.table.areaLabel}
          columns={s.table.columns}
          rows={s.table.rows.map((r) => ({ area: rt(r.area, v), cells: r.cells.map((c) => rt(c, v)) }))}
        />
      )}
      {s.outro && <p className="text-text-muted">{rt(s.outro, v)}</p>}
      {s.note && (
        <Note tag={s.note.tag}>
          <p>{rt(s.note.body, v)}</p>
        </Note>
      )}
    </>
  );
}
