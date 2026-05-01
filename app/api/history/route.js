/**
 * GET /api/history — returns search history for authenticated user
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getHistory } from '@/lib/db';

export async function GET(request) {
  const decoded = getAuthUser(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const history = await getHistory(decoded.id, 50);
  return NextResponse.json({ history });
}
