/**
 * GET /api/stats — public user count
 */

import { NextResponse } from 'next/server';
import { getTotalUsers } from '@/lib/db';

export async function GET() {
  try {
    const totalUsers = await getTotalUsers();
    return NextResponse.json({ totalUsers });
  } catch {
    return NextResponse.json({ totalUsers: 0 });
  }
}
