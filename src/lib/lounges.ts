// Lounge queries and the aggregates over approved reader stays that rated
// them. Shown once a lounge has MIN_STAYS rated stays.

import type { Where } from 'payload'

import { LOUNGE_FACTORS, type LoungeFactor } from '@/lib/stayOptions'
import type { Hotel, Lounge, LoungeRating } from '@/payload-types'

import { getPayloadClient } from './payload'
import { MIN_STAYS } from './readerData'

const published: Where = { _status: { equals: 'published' } }

export type LoungeAggregate = {
  stays: number // stays that used the lounge and gave an overall score
  accessRate: number | null // given over given plus declined
  score: number | null // mean overall score out of 5, one decimal
  factors: Record<LoungeFactor, number | null> // mean of each 1-5 score
  worthItRate: number | null // yes over yes plus no
  comments: number // stays that left a comment
}

function mean(values: number[]): number | null {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
}

export function aggregateLounge(answers: Pick<LoungeRating, 'access' | 'worthIt' | 'comment' | 'food' | 'drink' | 'space' | 'service' | 'overall'>[]): LoungeAggregate {
  const asked = answers.filter((l) => l.access === 'given' || l.access === 'declined')
  const given = asked.filter((l) => l.access === 'given').length
  const rated = answers.filter((l) => typeof l.overall === 'number')
  const worth = answers.filter((l) => l.worthIt === 'yes' || l.worthIt === 'no')
  const yes = worth.filter((l) => l.worthIt === 'yes').length
  const factors = Object.fromEntries(LOUNGE_FACTORS.map((f) => [f.name, mean(answers.map((l) => l[f.name]).filter((n): n is number => typeof n === 'number'))])) as Record<LoungeFactor, number | null>
  return {
    stays: rated.length,
    accessRate: asked.length ? Math.round((given / asked.length) * 100) : null,
    score: factors.overall,
    factors,
    worthItRate: worth.length ? Math.round((yes / worth.length) * 100) : null,
    comments: answers.filter((l) => l.comment?.trim()).length,
  }
}

export async function loungeReaderData(loungeId: number): Promise<{ count: number; data?: LoungeAggregate }> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'lounge-ratings',
    where: { and: [{ status: { equals: 'approved' } }, { lounge: { equals: loungeId } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const data = aggregateLounge(res.docs)
  if (data.stays < MIN_STAYS) return { count: data.stays }
  return { count: data.stays, data }
}

// Individual approved ratings for the lounge page, newest first, with the
// tier and (if signed in) the reader populated.
export async function getLoungeRatings(loungeId: number, limit = 100): Promise<LoungeRating[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'lounge-ratings',
    where: { and: [{ status: { equals: 'approved' } }, { lounge: { equals: loungeId } }] },
    sort: '-createdAt',
    limit,
    depth: 1,
    overrideAccess: true,
  })
  return res.docs
}

export async function getLounge(slug: string): Promise<Lounge | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'lounges', where: { and: [{ slug: { equals: slug } }, published] }, depth: 2, limit: 1 })
  return res.docs[0] ?? null
}

export async function getLoungesForHotel(hotelId: number): Promise<Lounge[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'lounges', where: { and: [{ hotel: { equals: hotelId } }, published] }, depth: 1, limit: 10 })
  return res.docs
}

export type LoungeRow = { lounge: Lounge; hotel: Hotel | null; data: LoungeAggregate | null }

export const LOUNGES_PER_PAGE = 24
export type LoungeFilters = { q?: string; program?: string; country?: string; rated?: string; page?: number }
export type LoungeDirectory = { rows: LoungeRow[]; totalDocs: number; totalPages: number; page: number; rated: number }

// A page of the lounge directory: rated lounges first, best first, then the
// rest by name. Ordering and paging happen in SQL over all lounges, and
// only the page's lounges are hydrated.
export async function getLoungeDirectory(f: LoungeFilters = {}): Promise<LoungeDirectory> {
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const page = Math.max(1, f.page ?? 1)
  const conds = [sql`l._status = 'published'`, sql`h._status = 'published'`]
  if (f.program) conds.push(sql`p.slug = ${f.program}`)
  if (f.country) conds.push(sql`d.country = ${f.country}`)
  if (f.q) conds.push(sql`(l.name ilike ${'%' + f.q + '%'} or h.name ilike ${'%' + f.q + '%'} or d.name ilike ${'%' + f.q + '%'})`)
  if (f.rated === 'yes') conds.push(sql`r.n >= ${MIN_STAYS}`)
  const where = sql.join(conds, sql` and `)
  const from = sql`from lounges l
    join hotels h on h.id = l.hotel_id
    left join programs p on p.id = h.program_id
    left join destinations d on d.id = h.destination_id
    left join (select lounge_id, count(*)::int as n, avg(overall) as score from lounge_ratings where status = 'approved' and overall is not null group by lounge_id) r on r.lounge_id = l.id
    where ${where}`
  const counts = await db.drizzle.execute(sql`select count(*)::int as total, count(*) filter (where r.n >= ${MIN_STAYS})::int as rated ${from}`)
  const totalDocs = Number(counts.rows[0]?.total ?? 0)
  const rated = Number(counts.rows[0]?.rated ?? 0)
  const ids = await db.drizzle.execute(
    sql`select l.id ${from} order by (case when r.n >= ${MIN_STAYS} then 0 else 1 end), r.score desc nulls last, l.name, h.name limit ${LOUNGES_PER_PAGE} offset ${(page - 1) * LOUNGES_PER_PAGE}`,
  )
  const order = ids.rows.map((r) => Number(r.id))
  if (order.length === 0) return { rows: [], totalDocs, totalPages: Math.max(1, Math.ceil(totalDocs / LOUNGES_PER_PAGE)), page, rated }
  const lounges = await payload.find({ collection: 'lounges', where: { id: { in: order } }, depth: 2, limit: LOUNGES_PER_PAGE })
  const byId = new Map(lounges.docs.map((l) => [l.id, l]))
  const rows = await Promise.all(
    order.map(async (id) => {
      const lounge = byId.get(id)
      if (!lounge) return null
      const d = await loungeReaderData(lounge.id)
      return { lounge, hotel: typeof lounge.hotel === 'object' ? lounge.hotel : null, data: d.data ?? null }
    }),
  )
  return { rows: rows.filter((r): r is LoungeRow => r !== null), totalDocs, totalPages: Math.max(1, Math.ceil(totalDocs / LOUNGES_PER_PAGE)), page, rated }
}

// The best-rated lounge on record, for the directory's hero photo.
export async function getTopLounge(): Promise<LoungeRow | null> {
  const res = await getLoungeDirectory({ rated: 'yes' })
  return res.rows[0] ?? null
}

// The access line for a directory row: tier short names, then club rooms and paid access.
export function accessLine(lounge: Lounge): string {
  const tiers = (lounge.access?.tiers ?? []).map((t) => (typeof t === 'object' ? (t.shortName ?? t.name) : null)).filter(Boolean) as string[]
  const parts = [...tiers]
  if (lounge.access?.clubRooms) parts.push('club rooms')
  if (lounge.access?.paid) parts.push('paid access')
  return parts.join(', ') || 'Access not recorded'
}

export function servicesLine(lounge: Lounge): string {
  const names: Record<string, string> = { breakfast: 'Breakfast', 'afternoon-tea': 'afternoon tea', evening: 'evening cocktails', 'all-day': 'all-day snacks' }
  const s = (lounge.services ?? []).map((x) => names[x.service] ?? x.service)
  return s.length ? s[0].charAt(0).toUpperCase() + s[0].slice(1) + (s.length > 1 ? ', ' + s.slice(1).join(', ') : '') : ''
}
