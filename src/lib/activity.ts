import { BREAKFAST_OUTCOMES, LATE_CHECKOUT_OUTCOMES, UPGRADE_OUTCOMES } from '@/lib/stayOptions'
import { getPayloadClient } from '@/lib/payload'

// Everything one reader has submitted, in one list. Three collections carry a
// reader: stays, comments and lounge ratings. Each has a moderation status, and
// seeing it is the point — a reader who cannot tell whether their stay was
// approved has no reason to believe the next one will be read either.

export type ActivityKind = 'stay' | 'comment' | 'rating'
export type ActivityStatus = 'pending' | 'approved' | 'rejected'

export type ActivityItem = {
  kind: ActivityKind
  id: number
  status: ActivityStatus
  createdAt: string
  title: string
  detail: string | null
  href: string | null
}

const KIND_LABEL: Record<ActivityKind, string> = { stay: 'Stay', comment: 'Comment', rating: 'Lounge rating' }
export const kindLabel = (k: ActivityKind) => KIND_LABEL[k]

const label = (options: { label: string; value: string }[], value: unknown) =>
  options.find((o) => o.value === value)?.label ?? null

// A relationship read at depth 1 is the document; at depth 0 it is the id.
const doc = <T,>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)

/** What a stay reports, in one line, without repeating the hotel name. */
function stayDetail(stay: Record<string, unknown>): string {
  const parts = [
    label(UPGRADE_OUTCOMES, stay.upgrade) === 'No' ? 'no upgrade' : label(UPGRADE_OUTCOMES, stay.upgrade)?.toLowerCase(),
    label(BREAKFAST_OUTCOMES, stay.breakfast) ? `breakfast ${label(BREAKFAST_OUTCOMES, stay.breakfast)!.toLowerCase()}` : null,
    label(LATE_CHECKOUT_OUTCOMES, stay.lateCheckout) ? `checkout ${label(LATE_CHECKOUT_OUTCOMES, stay.lateCheckout)!.toLowerCase()}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export async function readerActivity(readerId: number, limit = 200): Promise<ActivityItem[]> {
  const payload = await getPayloadClient()
  const where = { reader: { equals: readerId } }
  const opts = { where, limit, depth: 1, overrideAccess: true, sort: '-createdAt' } as const

  const [stays, comments, ratings] = await Promise.all([
    payload.find({ collection: 'reader-stays', ...opts }),
    payload.find({ collection: 'comments', ...opts }),
    payload.find({ collection: 'lounge-ratings', ...opts }),
  ])

  const items: ActivityItem[] = []

  for (const s of stays.docs as unknown as Record<string, unknown>[]) {
    const hotel = doc<{ name?: string; slug?: string }>(s.hotel)
    const tier = doc<{ name?: string }>(s.statusHeld)
    items.push({
      kind: 'stay',
      id: s.id as number,
      status: (s.status as ActivityStatus) ?? 'pending',
      createdAt: String(s.createdAt),
      title: [hotel?.name ?? 'A hotel', s.stayYear].filter(Boolean).join(', '),
      detail: [tier?.name, stayDetail(s)].filter(Boolean).join(' — ') || null,
      href: hotel?.slug ? `/hotels/${hotel.slug}` : null,
    })
  }

  for (const c of comments.docs as unknown as Record<string, unknown>[]) {
    // `on` is polymorphic: a review, an article or a lounge.
    const on = c.on as { relationTo?: string; value?: unknown } | undefined
    const target = doc<{ title?: string; name?: string; slug?: string }>(on?.value)
    const section = on?.relationTo === 'reviews' ? 'reviews' : on?.relationTo === 'articles' ? 'articles' : 'lounges'
    items.push({
      kind: 'comment',
      id: c.id as number,
      status: (c.status as ActivityStatus) ?? 'pending',
      createdAt: String(c.createdAt),
      title: target?.title ?? target?.name ?? 'A page',
      detail: String(c.body ?? '').replace(/\s+/g, ' ').slice(0, 140) || null,
      href: target?.slug ? `/${section}/${target.slug}` : null,
    })
  }

  for (const r of ratings.docs as unknown as Record<string, unknown>[]) {
    const lounge = doc<{ name?: string; slug?: string }>(r.lounge)
    const scores = [r.overall && `${r.overall}/5 overall`, r.worthIt === 'yes' ? 'worth a club room' : r.worthIt === 'no' ? 'not worth a club room' : null]
      .filter(Boolean)
      .join(' · ')
    items.push({
      kind: 'rating',
      id: r.id as number,
      status: (r.status as ActivityStatus) ?? 'pending',
      createdAt: String(r.createdAt),
      title: [lounge?.name ?? 'A lounge', r.stayYear].filter(Boolean).join(', '),
      detail: scores || null,
      href: lounge?.slug ? `/lounges/${lounge.slug}` : null,
    })
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Counts for the summary line, so a reader sees the shape of what they have sent. */
export function activityTotals(items: ActivityItem[]) {
  return {
    total: items.length,
    approved: items.filter((i) => i.status === 'approved').length,
    pending: items.filter((i) => i.status === 'pending').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    stays: items.filter((i) => i.kind === 'stay').length,
  }
}
