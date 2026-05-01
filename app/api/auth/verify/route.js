/**
 * POST /api/auth/verify — Verify OTP and return JWT token
 */

import { NextResponse } from 'next/server';
import { verifyOTP, createJWT } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const userInfo = verifyOTP(email, otp);
    if (!userInfo) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    const token = createJWT(userInfo);

    return NextResponse.json({
      success: true,
      token,
      user: {
        email: userInfo.email,
        wikiUsername: userInfo.wikiUsername,
      },
    });
  } catch (err) {
    console.error('[Auth Verify]', err);
    return NextResponse.json({ error: 'Verification failed', details: err.message }, { status: 500 });
  }
}
