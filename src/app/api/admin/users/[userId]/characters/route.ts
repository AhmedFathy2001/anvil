import { NextResponse } from 'next/server';

// POST /api/admin/users/[userId]/characters — RETIRED.
//
// This attached a character to a person on a clan admin's word, skipping every proof, and the link
// held in every clan that person plays in. Characters are the person's: they link their own (plugin,
// XP check), and anything a clan disputes or vouches for goes to Anvil (lib/characterReports →
// /staff/reports). A clan still controls its roster — who sits in it — through /api/admin/clan.
export async function POST() {
  return NextResponse.json(
    {
      error: 'Clan staff can no longer attach characters to people. Ask the player to link it themselves, or report it to Anvil.',
      code: 'reportToAnvil',
    },
    { status: 403 },
  );
}
