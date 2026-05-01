/**
 * Auth utilities — JWT + OTP + Email
 * Simple approach: no database needed.
 * - OTP stored in server memory (10 min expiry, auto-cleanup)
 * - User info stored in JWT itself
 */

import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_me';

// In-memory OTP store (email → { otp, expiresAt, userInfo })
const otpStore = new Map();

// Cleanup expired OTPs every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [email, data] of otpStore) {
      if (now > data.expiresAt) otpStore.delete(email);
    }
  }, 5 * 60 * 1000);
}

/** Generate 6-digit OTP */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Store OTP in memory with user info */
export function storeOTP(email, otp, userInfo) {
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    userInfo,
  });
}

/** Verify OTP — returns userInfo or null */
export function verifyOTP(email, otp) {
  const entry = otpStore.get(email);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { otpStore.delete(email); return null; }
  if (entry.otp !== otp) return null;
  const userInfo = entry.userInfo;
  otpStore.delete(email); // one-time use
  return userInfo;
}

/** Create JWT (7 days expiry) — user info is IN the token */
export function createJWT(user) {
  return jwt.sign(
    { email: user.email, wikiUsername: user.wikiUsername || user.globalWikiUsername },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/** Verify JWT → returns decoded payload or null */
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/** Extract auth user from request headers */
export function getAuthUser(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyJWT(authHeader.slice(7));
}

/** Send OTP email via NodeMailer */
export async function sendOTPEmail(email, otp) {
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'WikiSemanticImgSearch — Your Login OTP',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fa; border-radius: 12px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">🔐 Your Login OTP</h2>
        <p style="color: #555770; font-size: 14px;">Use this one-time code to log in to WikiSemanticImgSearch:</p>
        <div style="background: #3366cc; color: #fff; font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px 24px; border-radius: 8px; margin: 24px 0;">
          ${otp}
        </div>
        <p style="color: #8c8fa3; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #8c8fa3; font-size: 11px;">Semantic Image Search for Wikimedia Commons</p>
      </div>
    `,
  });
}
