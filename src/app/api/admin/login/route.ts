import { NextResponse } from 'next/server';
import { signUserToken, hashPasswordBcrypt, verifyPasswordBcrypt } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const allUsers = await db.select().from(users);

  // If no users exist yet, accept ADMIN_PASSWORD to seed the first admin
  if (allUsers.length === 0) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const loginUsername = username || 'admin';

    if (!adminPassword || password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Auto-seed first admin user
    const passwordHash = await hashPasswordBcrypt(password);
    const result = await db.insert(users).values({
      username: loginUsername,
      displayName: 'Admin',
      passwordHash,
      role: 'admin',
    }).returning();

    const newUser = result[0];
    const token = signUserToken(newUser.id, newUser.username, newUser.role);

    const response = NextResponse.json({
      success: true,
      redirectTo: '/admin/dashboard',
    });
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  // Users exist - look up by username
  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (user.length === 0) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const matched = await verifyPasswordBcrypt(password, user[0].passwordHash);
  if (!matched) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signUserToken(user[0].id, user[0].username, user[0].role);
  const redirectTo = user[0].role === 'admin' ? '/admin/dashboard' : '/admin/weekly';

  const response = NextResponse.json({
    success: true,
    redirectTo,
  });
  response.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
