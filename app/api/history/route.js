/**
 * GET /api/history — returns search history for authenticated user
 * DELETE /api/history — remove a specific history item
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getHistory, deleteHistoryItem } from '@/lib/db';

export async function GET(request) {
  const decoded = getAuthUser(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const history = await getHistory(decoded.id, 50);
  return NextResponse.json({ history });
}

export async function DELETE(request) {
  const decoded = getAuthUser(request);
  if (!decoded) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await deleteHistoryItem(decoded.id, id);
  return NextResponse.json({ success: true });
}
