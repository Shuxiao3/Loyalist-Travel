// What the hotel browsing pages need beyond the shared queries (mockups: hotels.html,
// destination.html, brand.html): the marks and figures on each hotel row, the program tabs and
// side lists of the Hotels list, and the side lists of destination and brand pages.
//
// Counts appear on the Hotels list only (its tabs and its region and city lists). Destination
// and brand pages use these lists without their counts.

import type { Where } from 'payload'

import type { Hotel } from '@/payload-types'

import { getHotelSnapshots, type HotelSnapshot } from './hotelSnapshot'
import { getPayloadClient } from './payload'
import { hotelWhere, type HotelFilters } from './queries'
import { PROGRAM_LINKS } from './site'
import { MIN_RATED_REPORTS, rankByUpgrade, type UpgradePool } from './upgradeRanking'

// Segment as the site writes it, sentence case ("Ultra luxury"), in order from the top
export const SEGMENT_LABEL: Record<NonNullable<Hotel['segment']>, string> = {
  'ultra-luxury': 'Ultra luxury',
  luxury: 'Luxury',
  upscale: 'Upscale',
  midscale: 'Midscale',
  budget: 'Budget',
  'extended-stay': 'Extended stay',
}

export const segmentLabel = (value?: string | null): string | null => (value ? ((SEGMENT_LABEL as Record<string, string>)[value] ?? null) : null)

// "Got an upgrade" prints once this many stays have said whether an upgrade came; a dash until then
export const MIN_UPGRADE_STAYS = MIN_RATED_REPORTS

// The site's programs in menu order, wherever this file lists them
const programRank = (slug: string) => {
  const i = PROGRAM_LINKS.findIndex((p) => p.slug === slug)
  return i < 0 ? PROGRAM_LINKS.length : i
}

type Db = { drizzle: { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> } }
async function db() {
  const payload = await getPayloadClient()
  const { sql } = await import('@payloadcms/db-postgres')
  return { payload, db: payload.db as unknown as Db, sql }
}

const idOf = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number' ? (v as { id: number }).id : null)

// ---------- Hotel rows ----------

export type HotelRowExtras = {
  snapshots: Record<number, HotelSnapshot> // by hotel id; every hotel asked for is present
  reviews: Map<number, { slug: string; score: number | null }> // the hotel's newest published review
  lounges: Map<number, string> // the slug of the hotel's published club lounge page
}

// Everything a page of hotel rows prints beside the hotel's own fields, in three reads. With
// `pool`, the upgrade figures count that pool alone, to match a list sorted by its upgrade chance.
export async function hotelRowExtras(hotels: Hotel[], pool?: UpgradePool): Promise<HotelRowExtras> {
  const ids = [...new Set(hotels.map((h) => h.id))]
  if (ids.length === 0) return { snapshots: {}, reviews: new Map(), lounges: new Map() }
  const payload = await getPayloadClient()
  const [snapshots, reviews, lounges] = await Promise.all([
    getHotelSnapshots(ids, pool),
    payload.find({ collection: 'reviews', where: { and: [{ _status: { equals: 'published' } }, { hotel: { in: ids } }] }, sort: '-publishedDate', depth: 0, pagination: false, select: { slug: true, hotel: true, totals: true } }),
    payload.find({ collection: 'lounges', where: { and: [{ _status: { equals: 'published' } }, { hotel: { in: ids } }] }, sort: 'name', depth: 0, pagination: false, select: { slug: true, hotel: true } }),
  ])
  const reviewBy = new Map<number, { slug: string; score: number | null }>()
  for (const r of reviews.docs) {
    const id = idOf(r.hotel)
    if (id != null && !reviewBy.has(id) && r.slug) reviewBy.set(id, { slug: r.slug, score: r.totals?.overall ?? null })
  }
  const loungeBy = new Map<number, string>()
  for (const l of lounges.docs) {
    const id = idOf(l.hotel)
    if (id != null && !loungeBy.has(id) && l.slug) loungeBy.set(id, l.slug)
  }
  return { snapshots, reviews: reviewBy, lounges: loungeBy }
}

// ---------- Hotels list ----------

export type ProgramTab = { slug: string; name: string; n: number }

// The Hotels list's program tabs: every program, in menu order, with how many hotels match the
// other filters in each, and the total for "All". A brand belongs to one program, and a tab for
// another program drops it (`brandProgram` is the slug of the brand's program), so that tab
// counts the program's hotels without it. Sorted by an upgrade chance (`pool`), the list holds only
// the hotels that rank, and so do the counts.
export async function programTabs(f: Omit<HotelFilters, 'sort' | 'page' | 'program'>, brandProgram?: string, pool?: UpgradePool): Promise<{ all: number; programs: ProgramTab[] }> {
  const payload = await getPayloadClient()
  const [programs, ranked] = await Promise.all([payload.find({ collection: 'programs', sort: 'name', limit: 20, depth: 0, select: { name: true, slug: true } }), pool ? rankByUpgrade(pool) : null])
  const only: Where[] = ranked ? [{ id: { in: ranked.length ? ranked.map((r) => r.id) : [0] } }] : []
  const countOf = async (where: Where[]) => (await payload.count({ collection: 'hotels', where: { and: [...where, ...only] } })).totalDocs
  const forProgram = (slug: string) => ({ ...f, program: slug, brand: f.brand && brandProgram && brandProgram !== slug ? undefined : f.brand })
  const [all, ...each] = await Promise.all([countOf(hotelWhere(f)), ...programs.docs.map((p) => countOf(hotelWhere(forProgram(p.slug))))])
  return {
    all,
    programs: programs.docs.map((p, i) => ({ slug: p.slug, name: p.name, n: each[i] })).sort((a, b) => programRank(a.slug) - programRank(b.slug) || a.name.localeCompare(b.name)),
  }
}

export type RegionCount = { slug: string; name: string; n: number }
export type CityCount = { slug: string; name: string; country: string | null; n: number }

// The Hotels list's side lists: hotels by region, most first, and the ten cities with the most
// hotels, both within one program when a program tab is open.
export async function hotelSideCounts(program?: string): Promise<{ regions: RegionCount[]; cities: CityCount[] }> {
  const { db: d, sql } = await db()
  const prog = program ? sql`and p.slug = ${program}` : sql``
  const [regions, cities] = await Promise.all([
    d.drizzle.execute(sql`select r.slug, r.name, count(h.id)::int as n from hotels h
      join destinations dst on dst.id = h.destination_id
      join regions r on r.id = dst.region_id
      left join programs p on p.id = h.program_id
      where h._status = 'published' ${prog}
      group by r.slug, r.name order by n desc, r.name`),
    d.drizzle.execute(sql`select dst.slug, dst.name, dst.country, count(h.id)::int as n from hotels h
      join destinations dst on dst.id = h.destination_id
      left join programs p on p.id = h.program_id
      where h._status = 'published' and dst._status = 'published' ${prog}
      group by dst.id, dst.slug, dst.name, dst.country order by n desc, dst.name limit 10`),
  ])
  return {
    regions: (regions.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name), n: Number(r.n) })),
    cities: (cities.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name), country: r.country ? String(r.country) : null, n: Number(r.n) })),
  }
}

// The regions in their display order, and the segments that have a hotel, for the filter menus
export async function hotelFilterExtras(): Promise<{ regions: { slug: string; name: string }[]; segments: { value: string; label: string }[] }> {
  const { payload, db: d, sql } = await db()
  const [regions, segs] = await Promise.all([
    payload.find({ collection: 'regions', sort: 'displayOrder', limit: 50, depth: 0, select: { name: true, slug: true } }),
    d.drizzle.execute(sql`select distinct segment from hotels where _status = 'published' and segment is not null`),
  ])
  const present = new Set((segs.rows ?? []).map((r) => String(r.segment)))
  return {
    regions: regions.docs.map((r) => ({ slug: r.slug, name: r.name })),
    segments: Object.entries(SEGMENT_LABEL)
      .filter(([v]) => present.has(v))
      .map(([value, label]) => ({ value, label })),
  }
}

// ---------- Destination and brand pages ----------

export const BROWSE_PER_PAGE = 60

// A page of the hotels in a destination or under a brand, in the Hotels list's default order:
// the most stays reported first, page views breaking ties, then A to Z.
export async function browseHotels(where: Where, page: number) {
  const payload = await getPayloadClient()
  return payload.find({ collection: 'hotels', where: { and: [{ _status: { equals: 'published' } }, where] }, sort: ['-reportCount', '-views', 'name'], depth: 1, limit: BROWSE_PER_PAGE, page })
}

// The programs with a hotel in a destination, in menu order (the destination page's tabs)
export async function programsIn(destinationId: number): Promise<{ slug: string; name: string }[]> {
  const { db: d, sql } = await db()
  const res = await d.drizzle.execute(sql`select distinct p.slug, p.name from hotels h join programs p on p.id = h.program_id where h._status = 'published' and h.destination_id = ${destinationId}`)
  return (res.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => programRank(a.slug) - programRank(b.slug) || a.name.localeCompare(b.name))
}

// The regions with a hotel of a brand, A to Z (the brand page's tabs)
export async function regionsOf(brandId: number): Promise<{ slug: string; name: string }[]> {
  const { db: d, sql } = await db()
  const res = await d.drizzle.execute(sql`select distinct r.slug, r.name from hotels h join destinations dst on dst.id = h.destination_id join regions r on r.id = dst.region_id where h._status = 'published' and h.brand_id = ${brandId}`)
  return (res.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => a.name.localeCompare(b.name))
}

// Other places in the same country with a published hotel, A to Z: the twelve with the most hotels
export async function moreInCountry(country: string, exceptId: number): Promise<{ slug: string; name: string }[]> {
  const { db: d, sql } = await db()
  const res = await d.drizzle.execute(sql`select dst.slug, dst.name, count(h.id)::int as n from destinations dst
    join hotels h on h.destination_id = dst.id and h._status = 'published'
    where dst._status = 'published' and dst.country = ${country} and dst.id <> ${exceptId}
    group by dst.id, dst.slug, dst.name order by n desc, dst.name limit 12`)
  return (res.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => a.name.localeCompare(b.name))
}

export type SideLounge = { slug: string; name: string; program: string | null; access: string }

// The club lounges at a destination's hotels, A to Z, each with its program and who gets in
export async function loungesIn(destinationId: number): Promise<SideLounge[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'lounges', where: { and: [{ _status: { equals: 'published' } }, { 'hotel.destination': { equals: destinationId } }] }, sort: 'name', depth: 2, limit: 20 })
  return res.docs.map((l) => {
    const hotel = l.hotel && typeof l.hotel === 'object' ? l.hotel : null
    const program = hotel?.program && typeof hotel.program === 'object' ? hotel.program.name : null
    const tiers = (l.access?.tiers ?? []).map((t) => (typeof t === 'object' ? (t.shortName ?? t.name) : null)).filter((t): t is string => Boolean(t))
    const access = [...tiers, ...(l.access?.clubRooms ? ['club rooms'] : []), ...(l.access?.paid ? ['paid access'] : [])].join(', ')
    // "Club Lounge, InterContinental Vienna", as the lounge directory names it
    return { slug: l.slug, name: hotel?.name ? `${l.name}, ${hotel.name}` : l.name, program, access }
  })
}

// The other brands of a program with a published hotel, A to Z
export async function siblingBrands(programId: number, exceptId: number): Promise<{ slug: string; name: string }[]> {
  const { db: d, sql } = await db()
  const res = await d.drizzle.execute(sql`select b.slug, b.name from brands b
    where b.program_id = ${programId} and b.id <> ${exceptId}
      and exists (select 1 from hotels h where h.brand_id = b.id and h._status = 'published')`)
  return (res.rows ?? []).map((r) => ({ slug: String(r.slug), name: String(r.name) })).sort((a, b) => a.name.localeCompare(b.name))
}
