/**
 * GET /api/auth/verify-username?username=xxx
 * Verify if a MediaWiki username exists on Commons
 */

import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ valid: false, error: 'Username required' }, { status: 400 });
  }

  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&list=users&ususers=${encodeURIComponent(username)}&format=json&origin=*`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    const user = data.query?.users?.[0];

    if (user && !user.missing) {
      return NextResponse.json({ valid: true, username: user.name });
    }
    return NextResponse.json({ valid: false, error: 'Username not found on Wikimedia Commons' });
  } catch (err) {
    return NextResponse.json({ valid: false, error: 'Could not verify username' }, { status: 500 });
  }
}
