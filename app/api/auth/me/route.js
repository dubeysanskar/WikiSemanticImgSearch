/**
 * GET /api/auth/me — Returns current authenticated user from JWT
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      email: user.email,
      wikiUsername: user.wikiUsername,
    },
  });
}
