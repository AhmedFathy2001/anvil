// Library guides → guide_pieces, for scripts/convert-guides-to-pieces.ts. An operator tool: it
// writes without an actor (the pieces are recorded as nobody's), leaves the guides themselves
// untouched, and by default only reports what it would do.

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { guidePieceRevisions, guidePieces, guides } from '@/db/schema';

import { convertGuideBody } from './convert';

export interface ConvertReport {
  guideId: number;
  slug: string;
  pieces: number;
  skipped: { what: string; why: string }[];
  /** 'converted' | 'would-convert' | 'has-pieces' (left alone without `replace`) */
  outcome: 'converted' | 'would-convert' | 'has-pieces';
}

export async function convertLibraryGuides(opts: { guideIds?: number[]; apply?: boolean; publish?: boolean; replace?: boolean } = {}): Promise<ConvertReport[]> {
  const rows = await db
    .select({ id: guides.id, slug: guides.slug, body: guides.body, status: guides.status })
    .from(guides)
    .where(and(isNull(guides.clanId), ...(opts.guideIds?.length ? [inArray(guides.id, opts.guideIds)] : [])));
  const out: ConvertReport[] = [];
  for (const g of rows) {
    const { pieces, skipped } = convertGuideBody(g.body);
    const existing = await db.select({ id: guidePieces.id }).from(guidePieces).where(eq(guidePieces.guideId, g.id)).limit(1);
    if (existing.length && !opts.replace) {
      out.push({ guideId: g.id, slug: g.slug, pieces: pieces.length, skipped, outcome: 'has-pieces' });
      continue;
    }
    if (!opts.apply) {
      out.push({ guideId: g.id, slug: g.slug, pieces: pieces.length, skipped, outcome: 'would-convert' });
      continue;
    }
    const at = new Date().toISOString();
    const status = opts.publish && g.status === 'published' ? 'published' : 'draft';
    await db.transaction(async (tx) => {
      if (opts.replace) await tx.delete(guidePieces).where(eq(guidePieces.guideId, g.id));
      for (const p of pieces) {
        const [row] = await tx
          .insert(guidePieces)
          .values({ guideId: g.id, sectionKey: p.sectionKey, roleKey: p.roleKey, variant: p.variant as Record<string, unknown>, kind: p.kind, body: p.body, position: p.position, status, version: 1, createdAt: at, updatedAt: at })
          .returning({ id: guidePieces.id });
        await tx.insert(guidePieceRevisions).values({
          clanId: null, guideId: g.id, pieceId: row.id, version: 1, kind: p.kind, body: p.body, meta: { section: p.sectionKey, role: p.roleKey, variant: p.variant, position: p.position, status }, action: 'create', createdAt: at,
        });
      }
    });
    out.push({ guideId: g.id, slug: g.slug, pieces: pieces.length, skipped, outcome: 'converted' });
  }
  return out;
}
