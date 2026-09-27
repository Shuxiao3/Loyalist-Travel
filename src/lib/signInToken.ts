import { createHash, randomBytes, timingSafeEqual } from 'crypto'

import { sql } from '@payloadcms/db-postgres'

import { getPayloadClient } from '@/lib/payload'

// Sign-in links: issue one, redeem it once. The table holds only a hash, so a
// leaked database row cannot be turned back into a working link.

export const TOKEN_MINUTES = 15

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export const normaliseEmail = (raw: string) => raw.trim().toLowerCase()

// Deliberately plain. A full RFC check rejects addresses that work and accepts
// ones that do not; the link either arrives or it does not.
export function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
}

async function drizzle() {
  const payload = await getPayloadClient()
  const adapter = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }
  return adapter.drizzle
}

// db.execute returns either rows directly or { rows } depending on the driver.
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const rows = (result as { rows?: unknown })?.rows
  return Array.isArray(rows) ? (rows as T[]) : []
}

/** A new link token for this email. Any link issued earlier stops working. */
export async function createSignInToken(email: string): Promise<string> {
  const db = await drizzle()
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000).toISOString()
  // Asking for a new link invalidates the old one, so a forwarded or
  // screenshotted link cannot be used after the reader asks again. Expired rows
  // from anyone are swept at the same time; nothing else would collect them.
  await db.execute(sql`DELETE FROM "auth_sign_in_tokens" WHERE "email" = ${email} OR "expires_at" <= now()`)
  await db.execute(sql`INSERT INTO "auth_sign_in_tokens" ("email", "token_hash", "expires_at") VALUES (${email}, ${hash(token)}, ${expires})`)
  return token
}

/**
 * Redeems a token, returning the email it was issued for, or null.
 *
 * The delete and the read are one statement, so two requests racing the same
 * token cannot both win: exactly one gets the row back. An expired token is
 * deleted and still returns null.
 */
export async function consumeSignInToken(token: string): Promise<string | null> {
  if (!token || token.length > 256) return null
  const db = await drizzle()
  const result = await db.execute(
    sql`DELETE FROM "auth_sign_in_tokens" WHERE "token_hash" = ${hash(token)} AND "expires_at" > now() RETURNING "email", "token_hash"`,
  )
  const row = rowsOf<{ email: string; token_hash: string }>(result)[0]
  if (!row) return null
  // The lookup was already by hash, so this only guards against a driver
  // returning a row for a different key; compared without leaking timing.
  const want = Buffer.from(hash(token))
  const got = Buffer.from(row.token_hash)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return row.email
}
