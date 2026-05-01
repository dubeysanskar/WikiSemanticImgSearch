/**
 * GET /api/stats — public stats
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ totalUsers: 0 });
}
