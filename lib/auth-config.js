/**
 * NextAuth.js configuration — Wikimedia OAuth 2.0
 * Handles user identity verification via meta.wikimedia.org
 */

import WikimediaProvider from 'next-auth/providers/wikimedia';

/** @type {import('next-auth').NextAuthOptions} */
export const authOptions = {
  providers: [
    WikimediaProvider({
      clientId: process.env.WIKIMEDIA_CLIENT_ID,
      clientSecret: process.env.WIKIMEDIA_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      // On first login, profile contains verified Wikimedia identity
      if (profile) {
        token.wikiUsername = profile.username || profile.name;
        token.wikiSub = profile.sub;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose verified wiki identity to the client
      session.user.wikiUsername = token.wikiUsername;
      session.user.wikiSub = token.wikiSub;
      return session;
    },
  },
  pages: {
    signIn: '/', // redirect back to home for custom modal
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};
