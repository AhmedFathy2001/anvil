import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';

const WOM_GROUP_ID = 20115;

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`https://api.wiseoldman.net/v2/groups/${WOM_GROUP_ID}`, {
      headers: {
        'User-Agent': 'OSRS-Bingo-Tracker',
      },
      next: { revalidate: 0 }, // Don't cache
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch from WOM' }, { status: 502 });
    }

    const data = await res.json();

    // Extract just the player info we need
    const members = data.memberships?.map((m: { role: string; player: { username: string; displayName: string; type: string } }) => ({
      username: m.player.username,
      displayName: m.player.displayName,
      type: m.player.type, // regular, ironman, ultimate, hardcore
      role: m.role,
    })) || [];

    return NextResponse.json({
      groupName: data.name,
      memberCount: data.memberCount,
      members,
    });
  } catch (error) {
    console.error('WOM fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch from WOM' }, { status: 500 });
  }
}
