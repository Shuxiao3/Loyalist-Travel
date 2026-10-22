// What the review pages need beyond the shared queries: the facts a review row prints (its
// place, brand and program) and the programs, countries and types that have a review, which
// the Reviews page offers as tabs and filters. Review lists are read at depth 1, which leaves
// each hotel's destination, brand and program as ids, so their names come in small reads.

import type { Brand, Destination, Hotel, Program, Review } from '@/payload-types'

import { getPayloadClient } from './payload'
import { PROGRAM_LINKS } from './site'

export type ReviewRowFacts = {
  place: string | null // "Prague, Czech Republic" (the destination's location label)
  city: string | null // "Prague"
  brand: string | null
  program: string | null
}

const idOf = (v: unknown): number | null => (typeof v === 'number' ? v : v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'number' ? (v as { id: number }).id : null)
const docOf = <T extends object>(v: unknown): T | null => (v && typeof v === 'object' ? (v as T) : null)

// The place, brand and program of each review's hotel, by review id.
export async function reviewRowFacts(reviews: Review[]): Promise<Map<number, ReviewRowFacts>> {
  const hotels = reviews.map((r) => docOf<Hotel>(r.hotel))
  const want = (pick: (h: Hotel) => unknown) => [...new Set(hotels.map((h) => (h && typeof pick(h) === 'number' ? (pick(h) as number) : null)).filter((n): n is number => n != null))]
  const destIds = want((h) => h.destination)
  const brandIds = want((h) => h.brand)
  const progIds = want((h) => h.program)
  const payload = await getPayloadClient()
  const [dests, brands, programs] = await Promise.all([
    destIds.length ? payload.find({ collection: 'destinations', where: { id: { in: destIds } }, depth: 0, limit: destIds.length, select: { name: true, locationLabel: true } }) : null,
    brandIds.length ? payload.find({ collection: 'brands', where: { id: { in: brandIds } }, depth: 0, limit: brandIds.length, select: { name: true } }) : null,
    progIds.length ? payload.find({ collection: 'programs', where: { id: { in: progIds } }, depth: 0, limit: progIds.length, select: { name: true } }) : null,
  ])
  const destById = new Map<number, Pick<Destination, 'name' | 'locationLabel'>>((dests?.docs ?? []).map((d) => [d.id, d]))
  const brandById = new Map<number, string>((brands?.docs ?? []).map((b) => [b.id, b.name]))
  const progById = new Map<number, string>((programs?.docs ?? []).map((p) => [p.id, p.name]))

  return new Map(
    reviews.map((r, i) => {
      const h = hotels[i]
      const destId = idOf(h?.destination)
      const dest = docOf<Destination>(h?.destination) ?? (destId != null ? destById.get(destId) : undefined) ?? null
      const brandId = idOf(h?.brand)
      const progId = idOf(h?.program)
      return [
        r.id,
        {
          place: dest?.locationLabel?.trim() || dest?.name || null,
          city: dest?.name ?? null,
          brand: docOf<Brand>(h?.brand)?.name ?? (brandId != null ? (brandById.get(brandId) ?? null) : null),
          program: docOf<Program>(h?.program)?.name ?? (progId != null ? (progById.get(progId) ?? null) : null),
        },
      ]
    }),
  )
}

export type ReviewFacets = {
  programs: { slug: string; name: string }[] // in the site's order
  countries: string[] // A to Z
  types: ('city' | 'resort')[]
}

// The programs, countries and property types that have at least one published review.
export async function reviewFacets(): Promise<ReviewFacets> {
  const payload = await getPayloadClient()
  const db = payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<{ rows: { slug: string | null; name: string | null; country: string | null; type: string | null }[] }> } }
  const { sql } = await import('@payloadcms/db-postgres')
  const res = await db.drizzle.execute(sql`select distinct p.slug, p.name, d.country, r.property_type as type from reviews r
    left join hotels h on h.id = r.hotel_id
    left join destinations d on d.id = h.destination_id
    left join programs p on p.id = h.program_id
    where r._status = 'published'`)
  const rows = res.rows ?? []
  const rank = (slug: string) => {
    const i = PROGRAM_LINKS.findIndex((p) => p.slug === slug)
    return i < 0 ? PROGRAM_LINKS.length : i
  }
  const programs = new Map<string, string>()
  for (const r of rows) if (r.slug && r.name) programs.set(r.slug, r.name)
  const countries = [...new Set(rows.map((r) => r.country?.trim()).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b))
  const present = new Set(rows.map((r) => r.type))
  return {
    programs: [...programs].map(([slug, name]) => ({ slug, name })).sort((a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name)),
    countries,
    types: (['city', 'resort'] as const).filter((t) => present.has(t)),
  }
}
