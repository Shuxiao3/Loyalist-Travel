import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

import { getPayloadClient } from '@/lib/payload'

// Reader sign-in, through Auth.js. Google is the only provider until an
// email sender exists for magic links. Sessions are signed cookies; the
// reader's record lives in the Readers collection, keyed by email.
export const authEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: authEnabled ? [Google] : [],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 90 },
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' || !user.email) return false
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified
      if (verified === false) return false
      const payload = await getPayloadClient()
      const email = user.email.toLowerCase()
      const found = await payload.find({ collection: 'readers', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
      const now = new Date().toISOString()
      if (found.docs[0]) {
        await payload.update({ collection: 'readers', id: found.docs[0].id, data: { lastSeenAt: now, googleSub: account.providerAccountId }, overrideAccess: true, depth: 0 })
      } else {
        await payload.create({ collection: 'readers', data: { email, googleSub: account.providerAccountId, lastSeenAt: now, status: 'active' }, overrideAccess: true, depth: 0 })
      }
      return true
    },
    async jwt({ token, user, trigger }) {
      // The id is the only thing worth carrying in the token: it is fixed for
      // an email, so it can be cached for the life of the cookie. The name and
      // the block flag are not — they are read fresh in the session callback.
      if ((user || trigger === 'update' || !token.readerId) && token.email) {
        const payload = await getPayloadClient()
        const found = await payload.find({ collection: 'readers', where: { email: { equals: String(token.email).toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })
        if (found.docs[0]) token.readerId = found.docs[0].id
      }
      return token
    },
    async session({ session, token }) {
      // Read the reader's row rather than trusting a copy in the token. Both
      // fields below change while a cookie lives: a reader picking a display
      // name saw nothing happen, because the page read the name the token was
      // minted with, and a reader blocked in the admin kept posting until their
      // token expired, up to ninety days later.
      //
      // Only set session.reader when a reader was actually resolved. Setting it
      // unconditionally made it truthy with an undefined id, which sent /login
      // to /account and /account straight back: a redirect loop with no way
      // out, because signing out lives on the page you could never reach.
      if (!token.readerId) return session
      const payload = await getPayloadClient()
      const reader = await payload.findByID({ collection: 'readers', id: token.readerId as number, depth: 0, overrideAccess: true }).catch(() => null)
      if (reader) {
        session.reader = { id: reader.id, displayName: reader.displayName ?? null, blocked: reader.status === 'blocked' }
      }
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    reader?: { id: number; displayName: string | null; blocked: boolean }
  }
}
