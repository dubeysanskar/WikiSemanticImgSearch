/**
 * POST /api/auth/register
 * Send OTP to user's email for login
 */

import { NextResponse } from 'next/server';
import { upsertUser, storeOTP } from '@/lib/db';
import { generateOTP, sendOTPEmail } from '@/lib/auth';

export async function POST(request) {
  try {
    const { email, wikiUsername, globalWikiUsername } = await request.json();

    if (!email || !wikiUsername || !globalWikiUsername) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Create/update user
    await upsertUser(email, wikiUsername, globalWikiUsername);

    // Generate and store OTP
    const otp = generateOTP();
    await storeOTP(email, otp);

    // Send OTP via email
    await sendOTPEmail(email, otp);

    return NextResponse.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    console.error('[Auth Register]', err);
    return NextResponse.json({ error: 'Failed to send OTP', details: err.message }, { status: 500 });
  }
}
