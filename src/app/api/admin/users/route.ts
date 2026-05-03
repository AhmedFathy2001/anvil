import { NextResponse } from 'next/server';
import { verifyAdmin, hashPasswordBcrypt } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    createdAt: users.createdAt,
    discordId: users.discordId,
    discordUsername: users.discordUsername,
    discordAvatar: users.discordAvatar,
    lastLoginAt: users.lastLoginAt,
    passwordHash: users.passwordHash,
  }).from(users);

  // Strip the password hash from the response — only the boolean "has one" leaves the server.
  return NextResponse.json(
    allUsers.map(({ passwordHash, ...rest }) => ({ ...rest, hasPassword: Boolean(passwordHash) })),
  );
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username, displayName, password, role } = await request.json();

  if (!username || !password || !role) {
    return NextResponse.json({ error: 'Username, password, and role are required' }, { status: 400 });
  }

  // POST creates legacy username/password staff. Discord-linked members get created
  // automatically via the OAuth callback, not here. We constrain to staff roles because
  // there's no point legacy-creating a 'member' (they'd just sign in via Discord).
  if (role !== 'admin' && role !== 'treasurer' && role !== 'moderator') {
    return NextResponse.json({ error: 'Role must be admin, treasurer, or moderator' }, { status: 400 });
  }

  const passwordHash = await hashPasswordBcrypt(password);

  try {
    const result = await db.insert(users).values({
      username,
      displayName: displayName || username,
      passwordHash,
      role,
    }).returning();

    return NextResponse.json({
      id: result[0].id,
      username: result[0].username,
      displayName: result[0].displayName,
      role: result[0].role,
      createdAt: result[0].createdAt,
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string' && (err as { message: string }).message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    throw err;
  }
}
