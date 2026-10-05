import { NextResponse } from 'next/server';

// DELETE /api/admin/users/[userId]/characters/[memberId] — RETIRED.
//
// This took a character off a person — in every clan, not just the one whose admin pressed it.
// Removing someone from THIS clan's roster is still a clan action (DELETE /api/admin/clan/[id]);
// taking the character away is Anvil's (lib/characterReports → /staff/reports).
export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Clan staff can no longer take characters off people. Remove them from your roster instead, or report the character to Anvil.',
      code: 'reportToAnvil',
    },
    { status: 403 },
  );
}
