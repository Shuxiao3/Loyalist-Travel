import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'

import { emailEnabled } from '@/lib/email'
import { getPayloadClient } from '@/lib/payload'
import { consumeSignInToken } from '@/lib/signInToken'

// Reader sign-in, through Auth.js. Google, or a single-use link by email for
// readers who would rather not use it. Sessions are signed cookies; the
// reader's record lives in the Readers collection, keyed by email.
//
// The email link is a credentials provider rather than Auth.js's own email
// provider, because that one requires a database adapter — and an adapter also
// takes over the Google path, resolving accounts through its own methods. That
// is a working flow, and not worth risking to save this file a few lines. What
// an adapter would have stored, a token table and this provider do instead.
export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET)
export const magicLinkEnabled = Boolean(process.env.AUTH_SECRET) && emailEnabled
export const authEnabled = googleEnabled || magicLinkEnabled

// Redeems a link token and hands back the reader it belongs to, creating the
// record on a first sign-in. Returning null fails the sign-in with no detail,
// which is all the reader should learn from a bad or spent link.
const EmailLink = Credentials({
  id: 'email-link',
  name: 'Email link',
  credentials: { token: { label: 'Token', type: 'text' } },
  async authorize(credentials) {
    const email = await consumeSignInToken(String(credentials?.token ?? ''))
    if (!email) return null
    const payload = await getPayloadClient()
    const found = await payload.find({ collection: 'readers', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    const now = new Date().toISOString()
    const reader = found.docs[0]
      ? await payload.update({ collection: 'readers', id: found.docs[0].id, data: { lastSeenAt: now }, overrideAccess: true, depth: 0 })
      : await payload.create({ collection: 'readers', data: { email, lastSeenAt: now, status: 'active' }, overrideAccess: true, depth: 0 })
    return { id: String(reader.id), email }
  },
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [...(googleEnabled ? [Google] : []), ...(magicLinkEnabled ? [EmailLink] : [])],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 90 },
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false
      // authorize() already redeemed the token and upserted the reader.
      if (account?.provider === 'email-link') return true
      if (account?.provider !== 'google') return false
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
        session.reader = {
          id: reader.id,
          displayName: reader.displayName ?? null,
          displayNameChangedAt: reader.displayNameChangedAt ?? null,
          // Ids only, and only so a stay form can preselect the tier this reader
          // says they hold. The row is already loaded, so they are free to carry.
          tiers: ((reader.tiers ?? []) as (number | { id: number })[]).map((x) => (typeof x === 'object' ? x.id : x)),
          blocked: reader.status === 'blocked',
        }
      }
      return session
    },
  },
})

declare module 'next-auth' {
  interface Session {
    reader?: { id: number; displayName: string | null; displayNameChangedAt: string | null; tiers: number[]; blocked: boolean }
  }
}
