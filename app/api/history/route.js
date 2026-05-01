/**
 * GET /api/history — returns search history for authenticated user
 * DELETE /api/history — remove a specific history item
 */

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getHistory, deleteHistoryItem } from '@/lib/db';

export async function GET(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const history = await getHistory(user.email, 50);
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await deleteHistoryItem(user.email, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
