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
      // on sign-in, and whenever the site asks for a refresh, copy the reader's record into the token
      if ((user || trigger === 'update' || !token.readerId) && token.email) {
        const payload = await getPayloadClient()
        const found = await payload.find({ collection: 'readers', where: { email: { equals: String(token.email).toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true })
        const r = found.docs[0]
        if (r) {
          token.readerId = r.id
          token.displayName = r.displayName ?? null
          token.blocked = r.status === 'blocked'
        }
      }
      return token
    },
    async session({ session, token }) {
      session.reader = { id: token.readerId as number, displayName: (token.displayName as string | null) ?? null, blocked: Boolean(token.blocked) }
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    reader?: { id: number; displayName: string | null; blocked: boolean }
  }
}
