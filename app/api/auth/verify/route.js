/**
 * POST /api/auth/verify
 * Verify OTP and return JWT token
 */

import { NextResponse } from 'next/server';
import { verifyOTP, getUserByEmail } from '@/lib/db';
import { createJWT } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const valid = await verifyOTP(email, otp);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const token = createJWT(user);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        wikiUsername: user.wiki_username,
        globalWikiUsername: user.global_wiki_username,
      },
    });
  } catch (err) {
    console.error('[Auth Verify]', err);
    return NextResponse.json({ error: 'Verification failed', details: err.message }, { status: 500 });
  }
}
