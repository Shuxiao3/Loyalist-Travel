// Lounge queries and the aggregates over approved reader stays that rated
// them. Shown once a lounge has MIN_STAYS rated stays.

import type { Where } from 'payload'

import { LOUNGE_FACTORS, type LoungeFactor } from '@/lib/stayOptions'
import type { Hotel, Lounge, LoungeRating } from '@/payload-types'

import { getPayloadClient } from './payload'
import { MIN_STAYS } from './readerData'
import { PROGRAM_LINKS } from './site'

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
// sort: 'city' (the default: by city, then hotel, A to Z), 'hotel' (by hotel, A to Z) or 'score'
// (rated lounges first, best first, then the rest by name)
export type LoungeFilters = { q?: string; program?: string; country?: string; region?: string; rated?: string; sort?: string; page?: number }
export type LoungeDirectory = { rows: LoungeRow[]; totalDocs: number; totalPages: number; page: number; rated: number }

// A page of the lounge directory, in the order asked for. Ordering and paging
// happen in SQL over all lounges, and only the page's lounges are hydrated.
export async function getLoungeDirectory(f: LoungeFilters = {}): Promise<LoungeDirectory> {
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const page = Math.max(1, f.page ?? 1)
  const conds = [sql`l._status = 'published'`, sql`h._status = 'published'`]
  if (f.program) conds.push(sql`p.slug = ${f.program}`)
  if (f.country) conds.push(sql`d.country = ${f.country}`)
  if (f.region) conds.push(sql`rg.slug = ${f.region}`)
  if (f.q) conds.push(sql`(l.name ilike ${'%' + f.q + '%'} or h.name ilike ${'%' + f.q + '%'} or d.name ilike ${'%' + f.q + '%'})`)
  if (f.rated === 'yes') conds.push(sql`r.n >= ${MIN_STAYS}`)
  const where = sql.join(conds, sql` and `)
  const from = sql`from lounges l
    join hotels h on h.id = l.hotel_id
    left join programs p on p.id = h.program_id
    left join destinations d on d.id = h.destination_id
    left join regions rg on rg.id = d.region_id
    left join (select lounge_id, count(*)::int as n, avg(overall) as score from lounge_ratings where status = 'approved' and overall is not null group by lounge_id) r on r.lounge_id = l.id
    where ${where}`
  const counts = await db.drizzle.execute(sql`select count(*)::int as total, count(*) filter (where r.n >= ${MIN_STAYS})::int as rated ${from}`)
  const totalDocs = Number(counts.rows[0]?.total ?? 0)
  const rated = Number(counts.rows[0]?.rated ?? 0)
  const order =
    f.sort === 'score'
      ? sql`(case when r.n >= ${MIN_STAYS} then 0 else 1 end), r.score desc nulls last, l.name, h.name`
      : f.sort === 'hotel'
        ? sql`h.name, l.name`
        : sql`d.name nulls last, h.name, l.name`
  const ids = await db.drizzle.execute(sql`select l.id ${from} order by ${order}, l.id limit ${LOUNGES_PER_PAGE} offset ${(page - 1) * LOUNGES_PER_PAGE}`)
  const pageIds = ids.rows.map((r) => Number(r.id))
  if (pageIds.length === 0) return { rows: [], totalDocs, totalPages: Math.max(1, Math.ceil(totalDocs / LOUNGES_PER_PAGE)), page, rated }
  const lounges = await payload.find({ collection: 'lounges', where: { id: { in: pageIds } }, depth: 2, limit: LOUNGES_PER_PAGE })
  const byId = new Map(lounges.docs.map((l) => [l.id, l]))
  const rows = await Promise.all(
    pageIds.map(async (id) => {
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
  const res = await getLoungeDirectory({ rated: 'yes', sort: 'score' })
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

// What the directory's menus, tabs and side list offer: the programs with a published lounge
// (in menu order), and the countries and regions with one (A to Z).
export async function loungeDirectoryOptions(): Promise<{ programs: { slug: string; name: string }[]; countries: string[]; regions: { slug: string; name: string }[] }> {
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const [programs, countries, regions] = await Promise.all([
    db.drizzle.execute(sql`select distinct p.slug, p.name from lounges l join hotels h on h.id = l.hotel_id join programs p on p.id = h.program_id where l._status = 'published' and h._status = 'published'`),
    db.drizzle.execute(sql`select distinct d.country from lounges l join hotels h on h.id = l.hotel_id join destinations d on d.id = h.destination_id where l._status = 'published' and h._status = 'published' and d.country is not null`),
    db.drizzle.execute(sql`select distinct rg.slug, rg.name from lounges l join hotels h on h.id = l.hotel_id join destinations d on d.id = h.destination_id join regions rg on rg.id = d.region_id where l._status = 'published' and h._status = 'published'`),
  ])
  const rank = (slug: string) => {
    const i = PROGRAM_LINKS.findIndex((p) => p.slug === slug)
    return i < 0 ? PROGRAM_LINKS.length : i
  }
  return {
    programs: (programs.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name)),
    countries: (countries.rows ?? []).map((r) => String(r.country)).sort((a, b) => a.localeCompare(b)),
    regions: (regions.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

// Other published lounges of the same name (a brand's club, as "Club InterContinental") at the
// program's hotels in the same country, A to Z by hotel; with none, the program's other lounges
// there. The program keeps a plain name ("Club Lounge") from mixing two programs' lounges.
export async function relatedLounges(lounge: Lounge, limit = 8): Promise<{ sameName: boolean; country: string | null; rows: { slug: string; hotel: string; place: string | null }[] }> {
  const hotel = typeof lounge.hotel === 'object' ? lounge.hotel : null
  const dest = hotel && typeof hotel.destination === 'object' ? hotel.destination : null
  const programId = hotel ? (typeof hotel.program === 'object' ? hotel.program?.id : hotel.program) : null
  const country = dest?.country ?? null
  if (!country) return { sameName: true, country: null, rows: [] }
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const find = (cond: unknown) =>
    db.drizzle.execute(sql`select l.slug, h.name as hotel, d.location_label as place, d.name as city from lounges l
      join hotels h on h.id = l.hotel_id join destinations d on d.id = h.destination_id
      where l._status = 'published' and h._status = 'published' and l.id <> ${lounge.id} and d.country = ${country} and ${cond}
      order by h.name limit ${limit}`)
  const map = (rows: Record<string, unknown>[]) => rows.map((r) => ({ slug: String(r.slug), hotel: String(r.hotel), place: r.place ? String(r.place) : r.city ? String(r.city) : null }))
  const same = await find(programId ? sql`lower(l.name) = lower(${lounge.name}) and h.program_id = ${programId}` : sql`lower(l.name) = lower(${lounge.name})`)
  if ((same.rows ?? []).length > 0) return { sameName: true, country, rows: map(same.rows) }
  if (!programId) return { sameName: false, country, rows: [] }
  const others = await find(sql`h.program_id = ${programId}`)
  return { sameName: false, country, rows: map(others.rows ?? []) }
}
