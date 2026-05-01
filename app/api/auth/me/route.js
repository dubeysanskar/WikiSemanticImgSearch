/**
 * GET /api/auth/me
 * Returns current authenticated user info
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getUserById } from '@/lib/db';

export async function GET(request) {
  const decoded = getAuthUser(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await getUserById(decoded.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      wikiUsername: user.wiki_username,
      globalWikiUsername: user.global_wiki_username,
    },
  });
}
