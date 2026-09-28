import type { CollectionAfterChangeHook } from 'payload'

import { emailEnabled, sendEmail } from '@/lib/email'

// A short note when a reader submits something, so nothing sits in the queue
// unread. Off until NOTIFY_EMAIL is set, like every other optional piece here.
//
// Sent by email rather than SMS because the site already has a working sender:
// no second account, no phone number, no per-message cost. On a phone it lands
// as a push either way. Swapping to SMS means replacing send() below.

// Read from the environment rather than taken from seo.ts, which now reaches the
// Seo global and so the whole Payload config. Three collections import this
// module, and collections are imported for their constants from the browser, so
// it stays free of anything server-only. middleware.ts duplicates this for the
// same reason.
const ADMIN_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const notifyEnabled = Boolean(process.env.NOTIFY_EMAIL) && emailEnabled

export type NotifyKind = 'reader-stays' | 'comments' | 'lounge-ratings'

const NOUN: Record<NotifyKind, string> = {
  'reader-stays': 'stay',
  comments: 'comment',
  'lounge-ratings': 'lounge rating',
}

/** Only new submissions, and only when configured. Pure, so it can be tested. */
export function shouldNotify(operation: string, enabled = notifyEnabled): boolean {
  return enabled && operation === 'create'
}

const idOf = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : null)

/**
 * A line naming what came in. Needs one lookup for the hotel or lounge name,
 * which is worth it: "New stay" tells you nothing you could not guess.
 */
async function describe(kind: NotifyKind, doc: Record<string, unknown>, payload: { findByID: (a: never) => Promise<unknown> }): Promise<string> {
  const name = async (collection: 'hotels' | 'lounges', value: unknown) => {
    const id = idOf(value)
    if (!id) return null
    try {
      const found = (await payload.findByID({ collection, id, depth: 0, overrideAccess: true } as never)) as { name?: string } | null
      return found?.name ?? null
    } catch {
      return null
    }
  }

  if (kind === 'reader-stays') {
    const hotel = await name('hotels', doc.hotel)
    return [hotel ?? 'a hotel', doc.stayYear].filter(Boolean).join(', ')
  }
  if (kind === 'lounge-ratings') {
    const lounge = await name('lounges', doc.lounge)
    return [lounge ?? 'a lounge', doc.overall ? `${doc.overall}/5` : null].filter(Boolean).join(' — ')
  }
  return String(doc.body ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
}

/**
 * An afterChange hook for one collection. Never throws: a reader's submission
 * must not fail because an email did not go out, and the hook runs inside their
 * request. Failures are logged for us and invisible to them.
 */
export function notifyOnCreate(kind: NotifyKind): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (!shouldNotify(operation)) return
    try {
      const to = process.env.NOTIFY_EMAIL as string
      const what = await describe(kind, doc as Record<string, unknown>, req.payload as never)
      const noun = NOUN[kind]
      const link = `${ADMIN_URL}/admin/collections/${kind}/${(doc as { id: number }).id}`
      const lines = [`A new ${noun} is waiting to be read.`, '', what, '', link]
      await sendEmail({
        to,
        subject: `New ${noun}: ${what || 'submitted'}`.slice(0, 120),
        text: lines.join('\n'),
        html: `<p style="font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">A new ${noun} is waiting to be read.<br><br><strong>${what || 'Submitted'}</strong><br><br><a href="${link}">Open it in the admin</a></p>`,
      })
    } catch (err) {
      console.error(`notifyOnCreate(${kind}):`, err)
    }
  }
}
