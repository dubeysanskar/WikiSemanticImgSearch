/**
 * POST /api/auth/register — Send OTP to user's email
 */

import { NextResponse } from 'next/server';
import { generateOTP, storeOTP, sendOTPEmail } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, globalWikiUsername } = await request.json();

    if (!email || !globalWikiUsername) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const otp = generateOTP();
    storeOTP(email, otp, { email, wikiUsername: globalWikiUsername });

    await sendOTPEmail(email, otp);

    return NextResponse.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('[Auth Register]', err);
    return NextResponse.json({ error: 'Failed to send OTP', details: err.message }, { status: 500 });
  }
}
