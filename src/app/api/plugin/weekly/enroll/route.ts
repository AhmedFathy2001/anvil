import { NextResponse } from 'next/server';

// RETIRED. The plugin stopped calling this in October (it dropped enrollWeekly); weekly competitions
// pick their entrants up from the roster sweep. It took no token — anyone could enter any of a clan's
// members into its running competition by name, and its two answers told a stranger whether a name
// was on the roster — so it goes rather than being guarded.
export async function POST() {
  return NextResponse.json({ error: 'Weekly entry is automatic now — nothing to enroll.' }, { status: 410 });
}
