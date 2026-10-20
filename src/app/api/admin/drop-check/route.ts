import { NextResponse } from 'next/server';
import { verifyTileEditorAnywhere } from '@/lib/auth';
import { libraryEditorUser } from '@/lib/guideAccess';
import { unobtainableItems } from '@/lib/dropSourceCheck';

// The tile editor asks, as a drop tile's items and sources change: which of these items can none of
// these sources drop? Here rather than in the browser because the drop tables are ~800KB.
export async function GET(request: Request) {
  const editor = (await verifyTileEditorAnywhere()) ?? (await libraryEditorUser());
  if (!editor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const items = (searchParams.get('items') ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 200);
  const sources = (searchParams.get('sources') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  return NextResponse.json({ missing: unobtainableItems(items, sources) });
}
