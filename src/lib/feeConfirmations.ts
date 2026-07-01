import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

// How many distinct staff confirmations a paid fee needs before it's settled. Admin-set via
// the `fee_confirmations_required` setting; defaults to 1 (single confirm, today's behaviour).
// Clamped to a sane 1–5.
export async function getRequiredConfirmations(): Promise<number> {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, 'fee_confirmations_required'),
  });
  const n = parseInt(row?.value || '1', 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 5);
}

export interface FeeConfirmation {
  userId: number;
  at: string;
}

export function parseConfirmations(json: string | null | undefined): FeeConfirmation[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is FeeConfirmation => e && typeof e.userId === 'number' && typeof e.at === 'string',
    );
  } catch {
    return [];
  }
}
