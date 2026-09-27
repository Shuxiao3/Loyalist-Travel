import { auth } from '@/auth'

export type CurrentReader = { id: number; email: string; displayName: string | null; displayNameChangedAt: string | null; tiers: number[]; blocked: boolean }

// The signed-in reader, or null. Reads the session cookie, so only call it
// from server code that is allowed to be dynamic (actions, account pages).
export async function currentReader(): Promise<CurrentReader | null> {
  const session = await auth()
  if (!session?.user?.email || !session.reader?.id) return null
  return {
    id: session.reader.id,
    email: session.user.email,
    displayName: session.reader.displayName,
    displayNameChangedAt: session.reader.displayNameChangedAt,
    tiers: session.reader.tiers ?? [],
    blocked: session.reader.blocked,
  }
}

