/**
 * NextAuth.js API Route — handles all /api/auth/* endpoints
 * Including /api/auth/callback/wikimedia
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-config';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
